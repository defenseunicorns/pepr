# Calling out to AWS SDK from pepr

## Introduction
This document explores how to call out to a specific AWS services within a Pepr module without exceeding the secret size limit. 

## Findings

| Type             | Imported SDK                     | File Size  |
|------------------|----------------------------------|------------|
| No AWS Import    | N/A                              | 11.5K      |
| Single AWS Service (ECR) | `import ECR from 'aws-sdk/clients/ecr'` | 140K   |
| All AWS Services | `import AWS from 'aws-sdk'`     | 1.4MB      |

## Conclusion
While it's still large to only pull in a single AWS service like ECR, it remains under the limit size of a secret. 
