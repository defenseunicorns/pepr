curl -k -H "Authorization: Bearer $TOKEN" "https://kubernetes:443/api/v1/namespaces/default/pods?watch=1&resourceVersion=962&allowWatchBookmarks=true&fieldSelector=metadata.name%3Ds"

curl -k -H "Authorization: Bearer $TOKEN" "https://kubernetes:443/api/v1/namespaces/default/pods?watch=1&allowWatchBookmarks=true&fieldSelector=metadata.name%3Ds"

curl -k -H "Authorization: Bearer $TOKEN" "https://kubernetes:443/api/v1/namespaces/pepr-system/peprstore?watch=1"

curl -k -H "Authorization: Bearer $TOKEN" "https://kubernetes:443/api/v1/namespaces/pepr-system/pods?watch=1"

curl -k -H "Authorization: Bearer $TOKEN" "https://kubernetes:443/api/v1/namespaces/pepr-system?watch=1"
