FROM cgr.dev/chainguard/go:1.20 as build

WORKDIR /work

COPY main.go .
COPY go.mod .
COPY go.sum .
COPY pkg pkg
COPY cmd cmd
COPY example.ts .
COPY tsconfig.json .
COPY sdk sdk

RUN go build -o pepr main.go

FROM cgr.dev/chainguard/static:latest
COPY --from=build /work/pepr /pepr
CMD ["/pepr"]
