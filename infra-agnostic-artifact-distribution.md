# Infra-Agnostic Artifact Distribution

We currently publish production artifacts to the following destinations:

- **CLI and library**: Distributed via [npm](https://www.npmjs.com/package/pepr).
- **Controller images**: Published to both [GitHub Container Registry (GHCR)](https://github.com/defenseunicorns/pepr/pkgs/container/pepr%2Fcontroller) and [Iron Bank](https://registry1.dso.mil/harbor/projects/3/repositories/opensource%2Fdefenseunicorns%2Fpepr%2Fcontroller/artifacts-tab).

---

## Fallback Distribution Strategy

If access to these services is lost, Pepr artifacts can be distributed through **any OCI-compliant registry** using the following process:

### **Run a Local `zot` Registry**

```bash
docker run --platform linux/amd64 -d -p 3333:5000 --name oras-quickstart ghcr.io/project-zot/zot-linux-amd64:latest
```

### **Build the Pepr Image and Library**

```bash
npm run build:image
```

### **Push Artifacts to the Local Registry**

```bash
oras push --plain-http localhost:3333/pepr-library:v0.38.1 \
   --artifact-type application/vnd.pepr.module.layer.v1 \
   pepr-0.0.0-development.tgz

docker tag pepr:dev localhost:3333/pepr:v0.38.1
docker push localhost:3333/pepr:v0.38.1
```

### **Pull Artifacts from the Local Registry**

```bash
oras pull localhost:3333/pepr-library:v0.38.1 
docker pull localhost:3333/pepr:v0.38.1
```

### **View Artifacts in the Registry**

```bash
oras discover localhost:3333/pepr-library:v0.38.1
```

---

This workflow ensures we can continue to build, ship, and consume Pepr artifacts without dependency on any specific infrastructure provider.
