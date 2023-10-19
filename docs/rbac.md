# RBAC Modes

During the build phase of Pepr (`npx pepr build --rbac-mode [admin|scoped]`), you have the option to specify the desired RBAC mode through specific flags. This allows you to fine-tune the level of access granted based on your requirements and preferences.

## Modes

**admin**   

```bash
npx pepr build --rbac-mode admin
```

**Description:** In this mode, the service account is given cluster-admin permissions, granting it full, unrestricted access across the entire cluster. This can be useful for administrative tasks where broad permissions are necessary. However, use this mode with caution, as it can pose security risks if misused. This is the default mode.

**scoped**

```bash
npx pepr build --rbac-mode scoped
```

**Description:** In the scoped mode, the principle of least privilege is applied. The service account is provided just enough permissions to perform its required tasks, and no more. This mode is recommended for most use cases as it limits potential attack vectors and aligns with best practices in security. _Should you initiate further interactions with the Kubernetes API involving resources, you'll need to ensure they are reflected in the ClusterRole._
