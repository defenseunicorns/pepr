# Changelog

## [2.0.1](https://github.com/defenseunicorns/pepr/compare/v2.0.0...v2.0.1) (2026-08-21)


### Dependencies

* bump dorny/paths-filter from 4.0.2 to 4.0.3 ([#3277](https://github.com/defenseunicorns/pepr/issues/3277)) ([5077db5](https://github.com/defenseunicorns/pepr/commit/5077db51796aaa6d8e7c1be4fb8acc40aa0526a4))
* bump the codeql-action group with 4 updates ([#3285](https://github.com/defenseunicorns/pepr/issues/3285)) ([d9be1c7](https://github.com/defenseunicorns/pepr/commit/d9be1c7128d9fe2e6e36885caada391f646c04a2))
* bump trufflesecurity/trufflehog from 3.96.0 to 3.97.0 ([#3286](https://github.com/defenseunicorns/pepr/issues/3286)) ([0056bfa](https://github.com/defenseunicorns/pepr/commit/0056bfacf28acc76e9db534c94c15852594e2837))
* **deps-dev:** bump the development-dependencies group across 1 directory with 3 updates ([#3284](https://github.com/defenseunicorns/pepr/issues/3284)) ([e20e53e](https://github.com/defenseunicorns/pepr/commit/e20e53e7c7501cd721d694b053bfb7ef700b8fb2))
* **deps-dev:** bump tsx from 4.23.5 to 4.23.8 in the development-dependencies group ([#3276](https://github.com/defenseunicorns/pepr/issues/3276)) ([d1255cf](https://github.com/defenseunicorns/pepr/commit/d1255cf62c5b0c5ea6cbe1b7792b68d5a6e4574e))
* **deps:** bump globals from 17.10.0 to 17.11.0 in the production-dependencies group ([#3283](https://github.com/defenseunicorns/pepr/issues/3283)) ([b16fc8b](https://github.com/defenseunicorns/pepr/commit/b16fc8b7976f1dce5c45b8e6f282a3838dda1508))
* **deps:** bump globals from 17.9.0 to 17.10.0 in the production-dependencies group ([#3280](https://github.com/defenseunicorns/pepr/issues/3280)) ([5a24078](https://github.com/defenseunicorns/pepr/commit/5a24078159c2acf1d5bb5280cbac988b8ad5e096))
* **deps:** bump the production-dependencies group with 2 updates ([#3278](https://github.com/defenseunicorns/pepr/issues/3278)) ([20d061d](https://github.com/defenseunicorns/pepr/commit/20d061d35a1d1492753fd7b3950271a5011812a7))

## [2.0.0](https://github.com/defenseunicorns/pepr/compare/v1.3.0...v2.0.0) (2026-08-12)


### ⚠ BREAKING CHANGES

* remove pepr format ([#3176](https://github.com/defenseunicorns/pepr/issues/3176))

### Features

* expose all probe properties with Kubernetes defaults ([#3247](https://github.com/defenseunicorns/pepr/issues/3247)) ([af340a7](https://github.com/defenseunicorns/pepr/commit/af340a73f7b6943e305ddff1cb50a37ed6d5437d))


### Bug Fixes

* clarify that --registry-info supports bare hostnames ([#3196](https://github.com/defenseunicorns/pepr/issues/3196)) ([ba0fae9](https://github.com/defenseunicorns/pepr/commit/ba0fae9a41a473af0b53158f606405ca2f98c852))
* remove pepr format ([#3176](https://github.com/defenseunicorns/pepr/issues/3176)) ([d77e288](https://github.com/defenseunicorns/pepr/commit/d77e288448cbe36173cf165f7d158338b7658694))


### Documentation

* add doctest for helm chart values ([#3253](https://github.com/defenseunicorns/pepr/issues/3253)) ([33bb9a4](https://github.com/defenseunicorns/pepr/commit/33bb9a4a3a56dbc05ac629f2ff1350013a028635))


### Dependencies

* bump actions/checkout from 7.0.0 to 7.0.1 ([#3228](https://github.com/defenseunicorns/pepr/issues/3228)) ([0ccf801](https://github.com/defenseunicorns/pepr/commit/0ccf801f1ab807c5908f109991f14ad0e5fbcb82))
* bump actions/setup-node from 6.4.0 to 7.0.0 ([#3220](https://github.com/defenseunicorns/pepr/issues/3220)) ([040e19e](https://github.com/defenseunicorns/pepr/commit/040e19e43fccf850ec970e56f65c73a5c5fb4227))
* bump azure/setup-helm from 5.0.0 to 5.0.1 ([#3204](https://github.com/defenseunicorns/pepr/issues/3204)) ([8b05966](https://github.com/defenseunicorns/pepr/commit/8b0596665a2bc97be48aee386c5223a63520a471))
* bump docker/login-action from 4.4.0 to 4.5.0 ([#3243](https://github.com/defenseunicorns/pepr/issues/3243)) ([e13d502](https://github.com/defenseunicorns/pepr/commit/e13d502c79dad3c55c639be80ad6c3515f48801d))
* bump docker/login-action from 4.5.0 to 4.5.1 ([#3246](https://github.com/defenseunicorns/pepr/issues/3246)) ([241afa2](https://github.com/defenseunicorns/pepr/commit/241afa222c236449882950e971a5eb6cc4a56b31))
* bump docker/login-action from 4.5.1 to 4.5.2 ([#3251](https://github.com/defenseunicorns/pepr/issues/3251)) ([720e8fc](https://github.com/defenseunicorns/pepr/commit/720e8fcb21324334522ba8da175a49d40b5b567c))
* bump docker/login-action from 4.5.2 to 4.6.0 ([#3270](https://github.com/defenseunicorns/pepr/issues/3270)) ([ce6e4e8](https://github.com/defenseunicorns/pepr/commit/ce6e4e81b0d4d31ed8d38e430edc9b2244ba8b54))
* bump docker/setup-buildx-action from 4.0.0 to 4.2.0 ([#3221](https://github.com/defenseunicorns/pepr/issues/3221)) ([461417b](https://github.com/defenseunicorns/pepr/commit/461417bf5af267b102e3c6193231cb5d95e6008a))
* bump dorny/paths-filter from 4.0.1 to 4.0.2 ([#3183](https://github.com/defenseunicorns/pepr/issues/3183)) ([23b5606](https://github.com/defenseunicorns/pepr/commit/23b5606385e83b2285f9a71db5661dc8dfacdf59))
* bump github/codeql-action/analyze from 4.37.0 to 4.37.1 ([#3225](https://github.com/defenseunicorns/pepr/issues/3225)) ([537317e](https://github.com/defenseunicorns/pepr/commit/537317e04a113699bd1420f211ee2f5f5566e83e))
* bump github/codeql-action/analyze from 4.37.1 to 4.37.3 ([#3241](https://github.com/defenseunicorns/pepr/issues/3241)) ([d0b660d](https://github.com/defenseunicorns/pepr/commit/d0b660d5778586f22aa39b96bdc7fff4a25a9e92))
* bump github/codeql-action/analyze from 4.37.3 to 4.37.4 ([#3256](https://github.com/defenseunicorns/pepr/issues/3256)) ([95f5fa6](https://github.com/defenseunicorns/pepr/commit/95f5fa62d87621aed8db9040bb843bcaba735df6))
* bump github/codeql-action/autobuild from 4.37.0 to 4.37.1 ([#3224](https://github.com/defenseunicorns/pepr/issues/3224)) ([d6fc63b](https://github.com/defenseunicorns/pepr/commit/d6fc63bf1e9be8d037a549c20f48ccc14d8cfbb0))
* bump github/codeql-action/autobuild from 4.37.1 to 4.37.3 ([#3240](https://github.com/defenseunicorns/pepr/issues/3240)) ([96f5766](https://github.com/defenseunicorns/pepr/commit/96f5766feccab1b8f8a7cb72354bc230714de618))
* bump github/codeql-action/autobuild from 4.37.3 to 4.37.4 ([#3258](https://github.com/defenseunicorns/pepr/issues/3258)) ([991cfeb](https://github.com/defenseunicorns/pepr/commit/991cfeb4b8e0617ef7364ffb2d3bb4b99219e187))
* bump github/codeql-action/init from 4.37.0 to 4.37.1 ([#3226](https://github.com/defenseunicorns/pepr/issues/3226)) ([4e9f407](https://github.com/defenseunicorns/pepr/commit/4e9f407c0975ddc3e572b8b5d0a986caef144799))
* bump github/codeql-action/init from 4.37.1 to 4.37.3 ([#3239](https://github.com/defenseunicorns/pepr/issues/3239)) ([ff91783](https://github.com/defenseunicorns/pepr/commit/ff917834d74274cdf5c506ff6fc4bbe2451d36f8))
* bump github/codeql-action/init from 4.37.3 to 4.37.4 ([#3259](https://github.com/defenseunicorns/pepr/issues/3259)) ([1f00636](https://github.com/defenseunicorns/pepr/commit/1f00636dbff82baecdc602c89d8b34982406275a))
* bump github/codeql-action/upload-sarif from 4.35.5 to 4.37.1 ([#3227](https://github.com/defenseunicorns/pepr/issues/3227)) ([0f85662](https://github.com/defenseunicorns/pepr/commit/0f8566296061a6a71f5debd0577ea637fd1f2b30))
* bump github/codeql-action/upload-sarif from 4.37.1 to 4.37.3 ([#3238](https://github.com/defenseunicorns/pepr/issues/3238)) ([1e962e7](https://github.com/defenseunicorns/pepr/commit/1e962e773369cf3bb017521ae8a814e2b32ca110))
* bump github/codeql-action/upload-sarif from 4.37.3 to 4.37.4 ([#3257](https://github.com/defenseunicorns/pepr/issues/3257)) ([77204a0](https://github.com/defenseunicorns/pepr/commit/77204a060a584d330abe99b01650c5116adf6ace))
* bump ossf/scorecard-action from 2.4.3 to 2.4.4 ([#3242](https://github.com/defenseunicorns/pepr/issues/3242)) ([af30e2d](https://github.com/defenseunicorns/pepr/commit/af30e2d38f5898f251278020a77e8528e009482c))
* bump slsa-framework/slsa-github-generator/actions/nodejs/publish from 4d014fae4dbd39eb09e8d40348b73db095e6ba9a to bb91a05077afa6601a3d7538c4cbbdbf0abe7ed9 ([#3264](https://github.com/defenseunicorns/pepr/issues/3264)) ([473b1d0](https://github.com/defenseunicorns/pepr/commit/473b1d080d48f7f846aab95c6c89027f7c4a3c7c))
* bump step-security/harden-runner from 2.20.0 to 2.20.1 ([#3273](https://github.com/defenseunicorns/pepr/issues/3273)) ([03da6bf](https://github.com/defenseunicorns/pepr/commit/03da6bf25c175569a69a9855707248510bbbf2cd))
* bump the codeql-action group with 4 updates ([#3272](https://github.com/defenseunicorns/pepr/issues/3272)) ([576fecf](https://github.com/defenseunicorns/pepr/commit/576fecf0f337100a351133b31d41401c3827278c))
* bump trufflesecurity/trufflehog from 3.95.8 to 3.95.9 ([#3206](https://github.com/defenseunicorns/pepr/issues/3206)) ([b9feb1d](https://github.com/defenseunicorns/pepr/commit/b9feb1d6b611209d539fa300576773a963487a67))
* bump trufflesecurity/trufflehog from 3.95.9 to 3.96.0 ([#3245](https://github.com/defenseunicorns/pepr/issues/3245)) ([1c06ee6](https://github.com/defenseunicorns/pepr/commit/1c06ee6ed788b2fb323ee0e790cf696f3e139037))
* **deps-dev:** bump fast-uri from 3.1.4 to 3.1.5 ([#3255](https://github.com/defenseunicorns/pepr/issues/3255)) ([f4653d3](https://github.com/defenseunicorns/pepr/commit/f4653d31469bc78d461716c1299916fa33a13e2b))
* **deps-dev:** bump js-yaml from 4.3.0 to 5.2.1 ([#3188](https://github.com/defenseunicorns/pepr/issues/3188)) ([6ccb08f](https://github.com/defenseunicorns/pepr/commit/6ccb08fdff5b178e2d63d57e65932b31f82c25b6))
* **deps-dev:** bump js-yaml from 5.2.1 to 5.2.2 ([#3229](https://github.com/defenseunicorns/pepr/issues/3229)) ([2a50a01](https://github.com/defenseunicorns/pepr/commit/2a50a0176ea8e70798591b198b8bee901b9516ab))
* **deps-dev:** bump postcss from 8.5.19 to 8.5.26 ([#3260](https://github.com/defenseunicorns/pepr/issues/3260)) ([08d75bb](https://github.com/defenseunicorns/pepr/commit/08d75bbcbc076d310e9a4ee08d27cfed9cb785ca))
* **deps-dev:** bump prettier from 3.8.3 to 3.9.6 in the development-dependencies group ([#3249](https://github.com/defenseunicorns/pepr/issues/3249)) ([1ee49e7](https://github.com/defenseunicorns/pepr/commit/1ee49e76b0723b2b7acfffb2eed31e198679e2ba))
* **deps-dev:** bump the development-dependencies group across 1 directory with 3 updates ([#3271](https://github.com/defenseunicorns/pepr/issues/3271)) ([6e53c98](https://github.com/defenseunicorns/pepr/commit/6e53c980d86ed3fb4dfc2c48da3b6d7ff888d53f))
* **deps-dev:** bump undici from 8.7.0 to 8.8.0 in the development-dependencies group ([#3232](https://github.com/defenseunicorns/pepr/issues/3232)) ([9ce91d1](https://github.com/defenseunicorns/pepr/commit/9ce91d1baa34b6598d5966c2d36984fccc148c14))
* **deps-dev:** bump undici from 8.8.0 to 8.9.0 in the development-dependencies group ([#3244](https://github.com/defenseunicorns/pepr/issues/3244)) ([175f5ec](https://github.com/defenseunicorns/pepr/commit/175f5ec60bad0e21ddd43ac7abded45328469a07))
* **deps:** bump brace-expansion from 5.0.7 to 5.0.9 ([#3230](https://github.com/defenseunicorns/pepr/issues/3230)) ([7120d03](https://github.com/defenseunicorns/pepr/commit/7120d0330f9b5b00745dd7d76e9e09555bf01bb3))
* **deps:** bump commander from 14.0.3 to 15.0.0 ([#3186](https://github.com/defenseunicorns/pepr/issues/3186)) ([33b2f11](https://github.com/defenseunicorns/pepr/commit/33b2f11f78a45281af0ce503a573f6418e893e2e))
* **deps:** bump esbuild from 0.28.0 to 0.28.1 ([#3216](https://github.com/defenseunicorns/pepr/issues/3216)) ([7087ccb](https://github.com/defenseunicorns/pepr/commit/7087ccb497bc07430f295531bb50aed05cebcdd8))
* **deps:** bump globals from 17.0.0 to 17.8.0 in the production-dependencies group ([#3248](https://github.com/defenseunicorns/pepr/issues/3248)) ([d22a463](https://github.com/defenseunicorns/pepr/commit/d22a463e85e5025f3f69dd87e5808763d51dc04c))
* **deps:** bump ip-address from 10.2.0 to 10.4.0 ([#3252](https://github.com/defenseunicorns/pepr/issues/3252)) ([f06359a](https://github.com/defenseunicorns/pepr/commit/f06359a3c7296f3ccc5841d98d724108f9f4d3ec))
* **deps:** bump quicktype-core from 23.3.23 to 26.0.0 ([#3233](https://github.com/defenseunicorns/pepr/issues/3233)) ([cd04379](https://github.com/defenseunicorns/pepr/commit/cd043795da0cf59d2ea9673f18015d5293ad9d4e))
* **deps:** bump the production-dependencies group across 1 directory with 3 updates ([#3200](https://github.com/defenseunicorns/pepr/issues/3200)) ([1ec9692](https://github.com/defenseunicorns/pepr/commit/1ec96929d2bc3295867c1a001ccf230b7d5e122f))
* **deps:** bump the production-dependencies group across 1 directory with 3 updates ([#3265](https://github.com/defenseunicorns/pepr/issues/3265)) ([d4b26f1](https://github.com/defenseunicorns/pepr/commit/d4b26f149f01cecd7bc367aa6637c4a090ca2afd))
* **deps:** bump the production-dependencies group with 2 updates ([#3231](https://github.com/defenseunicorns/pepr/issues/3231)) ([b5539ff](https://github.com/defenseunicorns/pepr/commit/b5539ffbefa0bca2f41908f7a61a7db2bf96f438))

## [1.3.0](https://github.com/defenseunicorns/pepr/compare/v1.2.2...v1.3.0) (2026-07-22)


### Features

* add configurable/overridable startup probes to deployments ([#3192](https://github.com/defenseunicorns/pepr/issues/3192)) ([a36402c](https://github.com/defenseunicorns/pepr/commit/a36402c83cbed5ab6280cbe136c9ed2238b5832d))


### Bug Fixes

* **ci:** exclude generated CHANGELOG.md from markdownlint ([#3215](https://github.com/defenseunicorns/pepr/issues/3215)) ([7bdea92](https://github.com/defenseunicorns/pepr/commit/7bdea9258be1f5e57bf3a60536b6108fa5cbc252))
* pin @types/node and add fast-uri override for CVE remediation ([#3210](https://github.com/defenseunicorns/pepr/issues/3210)) ([24bdee1](https://github.com/defenseunicorns/pepr/commit/24bdee1cb4790ddb83c00b8c396073f83fce0f42))


### Dependencies

* bump actions/checkout from 6.0.2 to 7.0.0 ([#3190](https://github.com/defenseunicorns/pepr/issues/3190)) ([ebeae29](https://github.com/defenseunicorns/pepr/commit/ebeae2986ee91a7dde585c927dd6e4ec84f87501))
* bump actions/create-github-app-token from 3.1.1 to 3.2.0 ([#3128](https://github.com/defenseunicorns/pepr/issues/3128)) ([343086c](https://github.com/defenseunicorns/pepr/commit/343086cb6495ae5e90715b3e4cd6edafd372a6b2))
* bump actions/dependency-review-action from 4.9.0 to 5.0.0 ([#3125](https://github.com/defenseunicorns/pepr/issues/3125)) ([7464a51](https://github.com/defenseunicorns/pepr/commit/7464a51147fe71234621fe2c77068cb597765461))
* bump codecov/codecov-action from 6.0.0 to 7.0.0 ([#3207](https://github.com/defenseunicorns/pepr/issues/3207)) ([bdbf44e](https://github.com/defenseunicorns/pepr/commit/bdbf44ea226dbbeac9985662ccbb812077fdf662))
* bump docker/login-action from 4.1.0 to 4.4.0 ([#3191](https://github.com/defenseunicorns/pepr/issues/3191)) ([df4aeb3](https://github.com/defenseunicorns/pepr/commit/df4aeb38285bfde8461bdf28e19324078a9585de))
* bump dorny/paths-filter from 3.0.3 to 4.0.1 ([#3149](https://github.com/defenseunicorns/pepr/issues/3149)) ([f6f6b22](https://github.com/defenseunicorns/pepr/commit/f6f6b22a8d6927ae949742e7904f42dbb40ad68a))
* bump github/codeql-action/autobuild from 4.35.5 to 4.37.0 ([#3189](https://github.com/defenseunicorns/pepr/issues/3189)) ([30928b6](https://github.com/defenseunicorns/pepr/commit/30928b6b8632feb1c2a31d4bb3d9f43b1a5da4f3))
* bump github/codeql-action/init from 4.35.5 to 4.37.0 ([#3205](https://github.com/defenseunicorns/pepr/issues/3205)) ([4d4e92f](https://github.com/defenseunicorns/pepr/commit/4d4e92faa1cc04adbda9b5a6fb572ffda25d19c5))
* bump peter-murray/workflow-application-token-action from 4.0.1 to 5.1.0 ([#3185](https://github.com/defenseunicorns/pepr/issues/3185)) ([9954e0a](https://github.com/defenseunicorns/pepr/commit/9954e0a7c38fb9a929fc933f663e6086d6ef1e7d))
* bump step-security/harden-runner from 2.19.3 to 2.20.0 ([#3169](https://github.com/defenseunicorns/pepr/issues/3169)) ([5e02544](https://github.com/defenseunicorns/pepr/commit/5e02544e8fa7aa2d707d9944f868513a907dd10d))
* bump trufflesecurity/trufflehog from 3.95.2 to 3.95.8 ([#3170](https://github.com/defenseunicorns/pepr/issues/3170)) ([214d943](https://github.com/defenseunicorns/pepr/commit/214d943d3dd0cf12b08af231d683f9ecc97a2ee8))
* **deps-dev:** bump the development-dependencies group across 1 directory with 2 updates ([#3199](https://github.com/defenseunicorns/pepr/issues/3199)) ([5f35a6b](https://github.com/defenseunicorns/pepr/commit/5f35a6b86c5d62684c6bf7ac9d1e126f5bc6c602))
* **deps-dev:** bump the development-dependencies group across 1 directory with 7 updates ([#3177](https://github.com/defenseunicorns/pepr/issues/3177)) ([5736fe7](https://github.com/defenseunicorns/pepr/commit/5736fe74d2c7b9b8b59cca6d9a5b377b57d78668))
* **deps-dev:** bump undici from 7.24.2 to 7.28.0 ([#3163](https://github.com/defenseunicorns/pepr/issues/3163)) ([9f49977](https://github.com/defenseunicorns/pepr/commit/9f4997760951098cbb19d0fc4c7d702d40ccc36e))
* **deps-dev:** bump undici from 7.28.0 to 8.7.0 ([#3138](https://github.com/defenseunicorns/pepr/issues/3138)) ([4eb03e7](https://github.com/defenseunicorns/pepr/commit/4eb03e728670a2a15b7ba7fcbe27d5ae742b1ceb))
* **deps:** bump body-parser from 2.2.1 to 2.3.0 ([#3202](https://github.com/defenseunicorns/pepr/issues/3202)) ([98d53ff](https://github.com/defenseunicorns/pepr/commit/98d53ff562c2dc36eb38dfcc276c9d619385632b))
* **deps:** bump brace-expansion from 5.0.6 to 5.0.7 ([#3201](https://github.com/defenseunicorns/pepr/issues/3201)) ([d450293](https://github.com/defenseunicorns/pepr/commit/d450293239af5f6193adcb2265c700f9e2f22239))
* **deps:** bump the production-dependencies group across 1 directory with 4 updates ([#3181](https://github.com/defenseunicorns/pepr/issues/3181)) ([f05c978](https://github.com/defenseunicorns/pepr/commit/f05c978ff943f425676fc767a5b13cc807e8baab))
* **deps:** bump ws from 8.18.3 to 8.21.1 ([#3130](https://github.com/defenseunicorns/pepr/issues/3130)) ([f70d896](https://github.com/defenseunicorns/pepr/commit/f70d8967607fa1412f35f1e51c7b0957a747899c))

## [1.2.2](https://github.com/defenseunicorns/pepr/compare/v1.2.1...v1.2.2) (2026-06-18)

### Dependencies

* bump actions/setup-node from 6.3.0 to 6.4.0 ([#3131](https://github.com/defenseunicorns/pepr/issues/3131)) ([8b958fb](https://github.com/defenseunicorns/pepr/commit/8b958fbf126370ff645123dc824807ddfcf237f4))
* bump chainguard node images from 24 to 26 and suppress irrelevant grype findings ([#3166](https://github.com/defenseunicorns/pepr/issues/3166)) ([4491fc1](https://github.com/defenseunicorns/pepr/commit/4491fc1f8639a76ac2259213693f093d7d4d2ba4))
* **deps-dev:** bump js-yaml from 4.1.1 to 4.2.0 ([#3164](https://github.com/defenseunicorns/pepr/issues/3164)) ([8505f94](https://github.com/defenseunicorns/pepr/commit/8505f945fcc228cf846918e54b6de30d85b618f1))
* **deps-dev:** bump vite from 8.0.14 to 8.0.16 ([#3161](https://github.com/defenseunicorns/pepr/issues/3161)) ([34b9baf](https://github.com/defenseunicorns/pepr/commit/34b9bafe6d134fdec877415d4ccca1fc74eb2d56))
* **deps:** bump form-data from 4.0.4 to 4.0.6 ([#3165](https://github.com/defenseunicorns/pepr/issues/3165)) ([b8d73bc](https://github.com/defenseunicorns/pepr/commit/b8d73bcfa3d603eb2d71a65d651a9fc74dc1eec8))

## [1.2.1](https://github.com/defenseunicorns/pepr/compare/v1.2.0...v1.2.1) (2026-06-01)

### Bug Fixes

* **ci:** point peer-deps-update at the App secrets that actually exist ([#3152](https://github.com/defenseunicorns/pepr/issues/3152)) ([da7a107](https://github.com/defenseunicorns/pepr/commit/da7a1077d9303a99fa1d9485be35ae1f8c2f8fee))
* **ci:** use app-token auth in peer-deps-update workflow ([#3151](https://github.com/defenseunicorns/pepr/issues/3151)) ([029e5e3](https://github.com/defenseunicorns/pepr/commit/029e5e3ef28444283967d5403b2bcd7fcdaf4bad))

### Dependencies

* bump @commitlint/config-conventional from 20.5.0 to 21.0.1 ([#3139](https://github.com/defenseunicorns/pepr/issues/3139)) ([f8b1aab](https://github.com/defenseunicorns/pepr/commit/f8b1aab910111462a819518a096e0e016a6ceacc))
* bump github/codeql-action from 4.35.3 to 4.35.5 ([#3145](https://github.com/defenseunicorns/pepr/issues/3145)) ([1c148c3](https://github.com/defenseunicorns/pepr/commit/1c148c3cf0bfe7b95e48eb30b20cb4087dcb1d8e))
* bump step-security/harden-runner from 2.19.1 to 2.19.3 ([#3146](https://github.com/defenseunicorns/pepr/issues/3146)) ([c5a56f8](https://github.com/defenseunicorns/pepr/commit/c5a56f8f4fb2832796fb3efe19128becffd3c924))
* **deps-dev:** bump @commitlint/cli from 20.5.0 to 21.0.1 ([#3147](https://github.com/defenseunicorns/pepr/issues/3147)) ([393b400](https://github.com/defenseunicorns/pepr/commit/393b4009e2f7cb93bff9c0cff167b1a0ffe8d5e0))
* **deps-dev:** bump the development-dependencies group across 1 directory with 2 updates ([#3137](https://github.com/defenseunicorns/pepr/issues/3137)) ([6512f52](https://github.com/defenseunicorns/pepr/commit/6512f529b1d1d96405283b4e85d4ad5af6bba944))
* **deps-dev:** bump the development-dependencies group across 1 directory with 4 updates ([#3150](https://github.com/defenseunicorns/pepr/issues/3150)) ([db2eac7](https://github.com/defenseunicorns/pepr/commit/db2eac7e00d61ac1472ee54cdd252172ad2460f9))
* **deps:** bump qs from 6.15.0 to 6.15.2 ([#3144](https://github.com/defenseunicorns/pepr/issues/3144)) ([7b7d7c9](https://github.com/defenseunicorns/pepr/commit/7b7d7c978aa3d03c25478fbe57a8417c67e6f0c7))
* **deps:** bump the production-dependencies group across 1 directory with 2 updates ([#3148](https://github.com/defenseunicorns/pepr/issues/3148)) ([5285d12](https://github.com/defenseunicorns/pepr/commit/5285d12d726a645ce10a6babe81b59c8f2c2ad58))
