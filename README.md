# HashThis 
### Immutable Proof of Existence on Nervos CKB

**HashThis** is a decentralized application (dApp) that anchors file fingerprints (SHA-256 hashes) to the **Nervos Common Knowledge Base (CKB)** blockchain. It allows users to create a permanent, tamper-proof timestamp for any digital file without revealing the file's contents to the network.

**Live Demo:** https://hash-this.vercel.app

---

## Key Features

* **Privacy-First:** Files are hashed locally in the browser using the Web Crypto API. Your actual file data never leaves your device; only the unique hash is sent to the network.
* **Immutable Anchoring:** Hashes are stored in unique Cells on the Nervos CKB Blockchain (Aggron4 Testnet).
* **Instant Verification:** Anyone can verify the existence and original timestamp of a file by re-hashing it and querying the blockchain.
* **Modern Stack:** Built with TypeScript, React, Vite, and the CCC SDK (Common Chain Connector).
* **Flexible Deployment:** Supports both serverless (Vercel) and traditional server (Express) architectures.

---

## Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React + Vite | Fast, client-side UI with local hashing logic. |
| **Styling** | Tailwind CSS | Responsive, modern design system. |
| **Backend** | Vercel Serverless / Express | Serverless functions or traditional REST API. |
| **Blockchain** | Nervos CKB | Layer 1 Proof-of-Work blockchain for maximum security. |
| **SDK** | @ckb-ccc/core | Modern TypeScript SDK for CKB with better concurrency handling. |
| **Deployment** | Vercel / Any Node host | Edge network or traditional server deployment. |

---

## Project Structure

```
HashThis/
├── api-backend/           # Vercel Serverless Backend (Production)
│   ├── api/
│   │   └── hashes/
│   │       ├── index.ts      # POST /api/hashes (submit)
│   │       ├── [hash].ts     # GET /api/hashes/:hash (verify)
│   │       └── ckb.service.ts # CKB blockchain logic (CCC SDK)
│   ├── vercel.json        # Serverless function config
│   └── package.json       # Backend dependencies
├── backend/               # Express Server Backend (Alternative)
│   ├── src/
│   │   ├── services/     # CKB blockchain logic
│   │   ├── controllers/  # API route handlers
│   │   ├── config/       # Environment configuration
│   │   └── index.ts      # Express server entry
│   └── package.json      # Express dependencies
├── frontend/             # React UI
│   ├── src/
│   │   ├── utils/       # Local Hashing (Web Crypto API)
│   │   ├── pages/       # Submit & Verify Views
│   │   └── services/    # API Client
│   └── vercel.json      # SPA routing config
└── README.md
```

---

## Deployment Options

### Option 1: Serverless (Vercel) - Recommended for Production

**Advantages:**
- ✅ Zero server maintenance
- ✅ Automatic scaling
- ✅ Free tier available (no credit card)
- ✅ Built-in CDN and CORS
- ✅ No cold starts

**Frontend:** https://hash-this.vercel.app  
**Backend API:** https://hash-this-api1.vercel.app

**Environment Variables (Backend):**
```
PRIVATE_KEY=0x... (your CKB testnet private key)
CKB_NETWORK=testnet
CORS_ORIGIN=https://hash-this.vercel.app
```

**Environment Variables (Frontend):**
```
VITE_API_URL=https://hash-this-api1.vercel.app/api
```

**Deployment Steps:**
1. Fork this repo
2. Connect to Vercel
3. Deploy `api-backend` as one project
4. Deploy `frontend` as another project
5. Add environment variables in Vercel dashboard
6. Done!

---

### Option 2: Traditional Server (Express) - For Self-Hosting

**Advantages:**
- ✅ Full control over infrastructure
- ✅ Familiar Express.js patterns
- ✅ Easy to debug and monitor
- ✅ Works with any Node.js host

**Use Cases:**
- Self-hosting on your own VPS
- Docker/Kubernetes deployments
- Development and testing
- Enterprise environments with specific requirements

#### Express Backend Setup

**Install Dependencies:**
```bash
cd backend
npm install
```

**Environment Configuration (`backend/.env`):**
```env
PORT=3001
NODE_ENV=production

# CKB Configuration (Aggron4 Testnet)
CKB_RPC_URL=https://testnet.ckb.dev/rpc
CKB_INDEXER_URL=https://testnet.ckb.dev/indexer
CKB_NETWORK=testnet

# Your Private Key (Testnet only!)
PRIVATE_KEY=0xYourTestnetPrivateKeyHere

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

**Run Express Server:**
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

The Express server will run on `http://localhost:3001`

**API Endpoints:**
- `POST /api/v1/hashes` - Submit hash
- `GET /api/v1/hashes/:hash` - Verify hash
- `GET /health` - Health check

**Deployment Targets:**
- Traditional VPS (DigitalOcean, Linode, AWS EC2)
- Docker containers
- Kubernetes clusters
- Any Node.js hosting service that allows Express apps

**Frontend Configuration for Express:**
Update `frontend/.env`:
```env
VITE_API_URL=http://your-server:3001/api/v1
```

---

## Local Development

### Prerequisites
* **Node.js:** v18 or higher (LTS recommended)
* **CKB Wallet:** A testnet wallet with funds from [Nervos Faucet](https://faucet.nervos.org/)

### Clone the Repository

```bash
git clone https://github.com/alienrobotninja/HashThis.git
cd HashThis
```

### Option A: Serverless Development (Vercel CLI)

**Backend:**
```bash
cd api-backend
npm install
npm install -g vercel
vercel dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**URLs:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

---

### Option B: Express Development

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**URLs:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

---

## API Documentation

### Submit Hash (Anchor)
Writes a new hash to the blockchain.

**Serverless:** `POST /api/hashes/index`  
**Express:** `POST /api/v1/hashes`

**Request:**
```json
{
  "fileHash": "0x546c01781527fb2d0d062540ca38f4dd727c67aeb58c00e4f2725600b3653ed5",
  "timestamp": "2026-02-28T09:00:00.000Z"
}
```

**Response:**
```json
{
  "txHash": "0x95fbed37ddc62d7d0b28429f005ee50539b3c1b67640ac985f3deeda73383810",
  "blockNumber": "pending",
  "status": "committed"
}
```

### Verify Hash (Audit)
Checks if a hash exists on-chain and retrieves its metadata.

**Serverless:** `GET /api/hashes/:hash`  
**Express:** `GET /api/v1/hashes/:hash`

**Example:** `GET /api/hashes/546c01781527fb2d0d062540ca38f4dd727c67aeb58c00e4f2725600b3653ed5`

**Response:**
```json
{
  "timestamp": "2026-02-28T09:00:00.000Z",
  "blockNumber": "12345678"
}
```

**404 Response (hash not found):**
```json
{
  "message": "Hash not found on chain"
}
```

---

## Architecture Notes

### Why CCC Instead of Lumos?
- **Better Concurrency:** CCC handles multiple simultaneous transactions without conflicts
- **Simpler API:** Automatic input collection and fee calculation
- **Official Support:** Actively maintained by CKB DevRel team
- **Future-Proof:** Recommended SDK for new CKB projects

### Serverless vs Traditional Express

| Feature | Serverless (Vercel) | Express Server |
|---------|---------------------|----------------|
| **Maintenance** | Zero | Manual updates |
| **Scaling** | Automatic | Manual/Auto-scaling |
| **Cost** | Free tier generous | VPS/hosting fees |
| **Cold Starts** | None (edge network) | N/A |
| **Control** | Limited | Full control |
| **Debugging** | Vercel logs | Direct access |
| **Best For** | Public demos, MVPs | Enterprise, self-hosting |

**Both backends use the same CKB service logic** - the only difference is the HTTP layer (serverless functions vs Express routes).

---

## Testing

Run the End-to-End test suite (Express backend only):

```bash
cd backend
npm test
```

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is open source and available under the [MIT License](LICENSE).

---

## Links

- **Live App:** https://hash-this.vercel.app
- **Backend API:** https://hash-this-api1.vercel.app
- **GitHub:** https://github.com/alienrobotninja/HashThis
- **CKB Explorer (Testnet):** https://pudge.explorer.nervos.org
- **CCC Documentation:** https://docs.nervos.org/docs/sdk-and-devtool/ccc
- **Issues Encountered:** [ISSUES_ENCOUNTERED.md](ISSUES_ENCOUNTERED.md)

---

Built with ❤️ by [Alien Robot Ninja 👽🤖🥷](https://github.com/alienrobotninja) on Nervos CKB