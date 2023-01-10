# Virtual Machines in PEPR

[KubeVirt](https://github.com/kubevirt) is a CNCF incubating project to integrate runtime virtualization with Kubernetes. KubeVirt is the leading(only) solution ready for supporting Virtual Machines in K8s.

## Ideal Future State

Virtual Machine orchestration has much to be desired and falls short compared with running containerized workloads.

Questions that need to be answered for a great, enterprise solution.
1. How can VMs be packaged and moved around like a container registry?

2. VMWare and similar solutions, provide Orchestration UIs. (create a VM, snapshots, backups, move, etc...). While KubeVirt API provides a mechanism to complete this work, it is low level and requires an SRE to be familiar with Kubernetes AND KubeVirt to perform relatively simple tasks. A VM orchestration solution is likely required.

Ideally,

1. VMs could be integrated by an engineer in a Zarf package and included in the zarf artifact when running `zarf package create`
2. Upon a  `zarf package deploy` the VM would be uploaded and created
3. A VM orchestration, either automatically or via User action, solution would start the VM
4. A user could access a VNC(remote) session connection using Baffles to the running VM, as necessary.


## Virtual Machine 

These sections outline the required steps to achieve a running virtual machine from nothing. These steps are currently performed manually by an SRE, as there is not automation or orchestration built.

Prerequisite: [KubeVirt Big Bang Package](https://repo1.dso.mil/platform-one/big-bang/apps/third-party/kubevirt) installed and running.

### Uploading
KubeVirt supports a wide range of virtual machine image types (i.e. ova, cqow2, etc...). Firts this image needs to be made available to the operator. For this, SREs can leverage Containerized Data Importer [CDI](https://github.com/kubevirt/containerized-data-importer) to upload the image to a Persistent Volume.

The most immediate mechanism to upload is interacting the the CDI API via `virtctl image-upload ...`

### Install

Virtual Machines are created using the `VirtualMachine` custom resource.

```yaml
apiVersion: kubevirt.io/v1
kind: VirtualMachine
metadata:
  name: testvm
spec:
  running: false
  template:
    metadata:
      labels:
        ...
    spec:
      domain:
        devices:
          disks:
            ...
          interfaces:
          ...
        resources:
          ...
      networks:
      ...
      volumes:
        - name: containerdisk
          containerDisk:
            image: quay.io/kubevirt/cirros-container-disk-demo
        - name: cloudinitdisk
          ...
```
*[full example](https://kubevirt.io/labs/manifests/vm.yaml)*

Note: this is a lightweight container example, but KubeVirt supports "real" VMs with larger disks and resource requirements see [SECTION TBD]()

### Running
Once a Virtual Machine (vm) custom resource is created. An SRE may change the `spec.running` field to true in the definition or more preferably use the `virtctl start testvm` cli utility.

When the Virtual Machine is running, users may access the VM using VNC. 


## Baffles

[Baffles](https://baffles.dev) is an open source tool built by Defense Unicorns and intends to be a delightful experience allowing the end user to focus on their mission/task. As it relates to VMs, Baffles integrates with Kubevirt API to connect to VNC sessions.

In order to "be discoverable" the VM would need a `BafflesApplication` custom resource

```yaml
apiVersion: app.baffles.dev/v1
kind: BafflesApplication
metadata:
  name: widnows10
  namespace: default
spec:
  displayName: "Windows 10"
  url: "ws://<NODE>:<PORT>/k8s/apis/subresources.kubevirt.io/v1alpha3/namespaces/default/virtualmachineinstances/iso-win10/vnc"
  category: "vm"
```