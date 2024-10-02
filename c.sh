KUBECONFIG_PATH=~/.kube/config

# Extract `certificate-authority-data`, `client-certificate-data`, `client-key-data`
CA_CERT_DATA=$(yq eval '.clusters[] | select(.name == "k3d-k3s-default") | .cluster["certificate-authority-data"]' $KUBECONFIG_PATH | base64 -d)
CLIENT_CERT_DATA=$(yq eval '.users[] | select(.name == "admin@k3d-k3s-default") | .user["client-certificate-data"]' $KUBECONFIG_PATH | base64 -d)
CLIENT_KEY_DATA=$(yq eval '.users[] | select(.name == "admin@k3d-k3s-default") | .user["client-key-data"]' $KUBECONFIG_PATH | base64 -d)

# Save these values to temporary files
echo "$CA_CERT_DATA" > /tmp/ca.crt
echo "$CLIENT_CERT_DATA" > /tmp/client.crt
echo "$CLIENT_KEY_DATA" > /tmp/client.key

# Use curl with the extracted certificates
curl --cacert /tmp/ca.crt \
     --cert /tmp/client.crt \
     --key /tmp/client.key \
     https://0.0.0.0:63115/api/v1/namespaces/default/pods
