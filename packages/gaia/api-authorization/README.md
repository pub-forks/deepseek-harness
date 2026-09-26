---
description: "Gaia's authenticated browser Remote for registered sign-in flows."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-api-authorization

English | [中文](README.zh.md)

## Summary

This private host plugin exposes registered `ctx.authorization` flows through the normal cookie-protected API Gateway. `listFlows` returns labels, methods, in-flight state, and credential-record presence. Credential payloads and answers never enter the list response or logs.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount the plugin in the Gaia overlay after the authorization and credential services. The browser client mounts its generated `./remote` contribution. `start` streams notices, prompts, withdrawals, and a terminal outcome. Every item carries an `attemptId` for `answer` and `cancel`; closing the stream cancels the attempt. A second attempt on the same key receives `busy`. `signOut` accepts registered flow keys only and deletes their stored records.

-----

<a id="dev-note"></a>
## Dev Note

No runtime invariant companion applies: this plugin's registration and disposal are owned by its existing Cordis service or slot lifecycle.

-----

<a id="model-experience"></a>
## Model Experience

### Gaia sign-in

#### What the model sees

No direct contribution; sign-in changes credentials that an LLM provider may use on later requests.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package does not assemble model requests.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

The generic credential record seam has no account or expiry metadata. Those optional fields remain absent from `listFlows`; the grant payload is opaque and must not be inspected here.
