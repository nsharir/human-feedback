# Getting Started with the SDK

This guide walks you through installing and configuring the SDK for the first time.

## Installation

Install the package via your package manager:

```bash
npm install @acme/sdk
```

Or with yarn:

```bash
yarn add @acme/sdk
```

## Authentication

All API requests require a valid **Bearer token** passed in the `Authorization` header. You can generate tokens from your dashboard.

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.acme.com/v1/whoami
```

## Quick start

1. Import the SDK into your project
2. Initialize it with your API key
3. Make your first request

```js
import { Client } from '@acme/sdk';

const client = new Client({ apiKey: process.env.ACME_KEY });
const user = await client.users.me();
console.log(user);
```

## Next steps

- Read the [API reference](https://docs.acme.com/api)
- Browse [example projects](https://github.com/acme/examples)
- Join the [community Discord](https://discord.gg/acme)
