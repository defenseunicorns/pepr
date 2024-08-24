Which Sidecar
```yaml
        - name: informer
          image: watch-infomer:dev  
          imagePullPolicy: Never
          args: ["--log-level=debug"]
          ports:
          - containerPort: 50051
          resources:
            requests:
              memory: 64Mi
              cpu: 100m
            limits:
              memory: 256Mi
              cpu: 500m
```

Change watchers
```yaml
            - name: PEPR_WATCH_INFORMER
              value: 'true'
```

```ts
    !process.env.PEPR_WATCH_INFORMER && (await watcher.start());
```


Logs 

```bash
k logs -n pepr-system   deploy/pepr-static-test-watcher -c informer -f | jq 
k logs -n pepr-system   deploy/pepr-static-test-watcher -c watcher -f | jq 
```

k3d image import watch-infomer:dev   -c pepr-dev 
