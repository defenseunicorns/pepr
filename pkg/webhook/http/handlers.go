// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Package http provides a http server for the agent.
package http

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/defenseunicorns/pepr/pkg/webhook/operations"
	"github.com/defenseunicorns/zarf/src/config/lang"
	"github.com/defenseunicorns/zarf/src/pkg/message"
	v1 "k8s.io/api/admission/v1"
	meta "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
)

// admissionHandler represents the HTTP handler for an admission webhook.
type admissionHandler struct {
	decoder runtime.Decoder
}

// newAdmissionHandler returns an instance of AdmissionHandler.
func newAdmissionHandler() *admissionHandler {
	return &admissionHandler{
		decoder: serializer.NewCodecFactory(runtime.NewScheme()).UniversalDeserializer(),
	}
}

// Serve returns a http.HandlerFunc for an admission webhook.
func (h *admissionHandler) Serve(hook operations.Hook) http.HandlerFunc {
	message.Debugf("http.Serve(%#v)", hook)
	return func(w http.ResponseWriter, r *http.Request) {
		message.Debugf("http.Serve()(writer, %#v)", r.URL)

		// Set the Content-Type header to application/json.
		w.Header().Set("Content-Type", "application/json")

		// Return an error if the HTTP method is not POST.
		if r.Method != http.MethodPost {
			http.Error(w, lang.AgentErrInvalidMethod, http.StatusMethodNotAllowed)
			return
		}

		// Return an error if the Content-Type header is not application/json.
		if contentType := r.Header.Get("Content-Type"); contentType != "application/json" {
			http.Error(w, lang.AgentErrInvalidType, http.StatusBadRequest)
			return
		}

		// Read the request body.
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, fmt.Sprintf(lang.AgentErrBadRequest, err), http.StatusBadRequest)
			return
		}

		// Decode the request body into an AdmissionReview object.
		var review v1.AdmissionReview
		if _, _, err := h.decoder.Decode(body, nil, &review); err != nil {
			http.Error(w, fmt.Sprintf(lang.AgentErrCouldNotDeserializeReq, err), http.StatusBadRequest)
			return
		}

		// Return an error if the request is nil.
		if review.Request == nil {
			http.Error(w, lang.AgentErrNilReq, http.StatusBadRequest)
			return
		}

		// Execute the admission hook and get the result.
		result, err := hook.Execute(review.Request)
		if err != nil {
			message.Error(err, lang.AgentErrBindHandler)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		// Create an AdmissionReview object to hold the response.
		admissionResponse := v1.AdmissionReview{
			TypeMeta: meta.TypeMeta{
				APIVersion: v1.SchemeGroupVersion.String(),
				Kind:       "AdmissionReview",
			},
			Response: &v1.AdmissionResponse{
				UID:     review.Request.UID,
				Allowed: result.Allowed,
				Result:  &meta.Status{Message: result.Msg},
			},
		}

		// Set the patch operations for mutating admission.
		if len(result.PatchOps) > 0 {
			jsonPatchType := v1.PatchTypeJSONPatch
			patchBytes, err := json.Marshal(result.PatchOps)
			if err != nil {
				message.Error(err, lang.AgentErrMarshallJSONPatch)
				http.Error(w, lang.AgentErrMarshallJSONPatch, http.StatusInternalServerError)
			}
			admissionResponse.Response.Patch = patchBytes
			admissionResponse.Response.PatchType = &jsonPatchType
		}

		// Marshal the AdmissionReview object into JSON and write the response.
		jsonResponse, err := json.Marshal(admissionResponse)
		if err != nil {
			message.Error(err, lang.AgentErrMarshalResponse)
			http.Error(w, lang.AgentErrMarshalResponse, http.StatusInternalServerError)
			return
		}

		message.Debug("PATCH: ", string(admissionResponse.Response.Patch))
		message.Debug("RESPONSE: ", string(jsonResponse))

		message.Infof(lang.AgentInfoWebhookAllowed, r.URL.Path, review.Request.Operation, result.Allowed)

		// Write the response.
		w.WriteHeader(http.StatusOK)
		w.Write(jsonResponse)
	}
}

func healthz() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}
}
