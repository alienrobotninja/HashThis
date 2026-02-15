# Milestone 1 Report: Scope and Foundations
**Duration**: Weeks 1-2  
**Status**: ✅ Completed  
**Start Date**: 2026.01.26

---

## Objectives

- ✅ Finalize functional scope and success criteria for the prototype
- ✅ Define clear user flows for hashing, anchoring, and verification
- ✅ Set up the open-source repository and project structure
- ✅ Configure CKB testnet environment and tooling

---

## Accomplishments

### 1. Functional Scope Definition

**Success Criteria Established**:
- Local client-side hashing for privacy preservation
- Blockchain anchoring of hash + timestamp on CKB testnet
- Verification workflow for data integrity checking
- No raw data storage on server or blockchain
- Support for text and file hashing (up to 10MB initially)

**Out of Scope for Prototype**:
- Mainnet deployment
- Batch hash submissions
- Encryption features
- Access control mechanisms
- Mobile applications

### 2. User Flow Documentation

**Primary User Flows Defined**:

**Flow 1: Hash Submission**
```
User → Upload/Input Data → Compute Hash (client-side) → 
Submit to Backend → Create CKB Transaction → 
Receive Confirmation → Display TX Hash
```

**Flow 2: Hash Verification**
```
User → Re-Upload/Re-Input Data → Recompute Hash → 
Query Blockchain → Compare Hashes → 
Display Verification Result (Match/No Match)
```

**Flow 3: Hash Query**
```
User → Enter Search Criteria → Query Backend → 
Retrieve Records → Display Results
```

### 3. Repository Structure

**Created Project Structure**:
```
hashthis/
├── backend/           # Node.js TypeScript API
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── config/
│   └── tests/
├── frontend/          # React TypeScript UI
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   └── tests/
├── contracts/         # CKB scripts (future)
├── tests/            # Integration & E2E tests
├── docs/             # Documentation
└── scripts/          # Deployment scripts
```

**Version Control Setup**:
- Git repository initialized
- `.gitignore` configured for Node.js and sensitive files
- Branch strategy: main (stable), develop (active development)
- MIT License applied

### 4. CKB Testnet Configuration

**Testnet Connection Established**:
- RPC Endpoint: `https://testnet.ckb.dev/rpc`
- Indexer Endpoint: `https://testnet.ckb.dev/indexer`
- Network: Aggron4 (CKB Testnet)

**Development Wallet Created**:
- Test account with CKBytes acquired from faucet
- Private key securely stored in environment variables
- Address: `ckt1...` (testnet address format)

**Tooling Configured**:
- CKB SDK (@ckb-lumos/lumos) integrated
- Transaction builder configured
- Indexer for querying blockchain state

---

## Technical Decisions

### Technology Stack

**Backend**:
- **Language**: TypeScript
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **CKB SDK**: Lumos (preferred over ckb-sdk-core for better TypeScript support)
- **Validation**: Joi
- **Logging**: Winston

**Frontend**:
- **Language**: TypeScript
- **Framework**: React 18
- **Build Tool**: Vite (faster than Create React App)
- **Styling**: Tailwind CSS
- **State Management**: Zustand (lightweight)
- **HTTP Client**: Axios

**Testing**:
- **Unit Tests**: Jest/Vitest
- **Integration Tests**: Supertest
- **E2E Tests**: Playwright (planned for Milestone 3)

### Architecture Decisions

1. **Monorepo Structure**: Easier dependency management and shared types
2. **TypeScript**: Type safety across full stack
3. **RESTful API**: Simple, well-understood pattern
4. **Client-Side Hashing**: Privacy-preserving, reduces server load
5. **Stateless Backend**: Scalability and simplicity

---

## Deliverables

### Documentation
- ✅ README.md with project overview
- ✅ Architecture documentation
- ✅ Setup instructions
- ✅ API endpoint specifications

### Code
- ✅ Project scaffolding complete
- ✅ TypeScript configurations
- ✅ Environment setup templates
- ✅ Basic middleware (CORS, logging, error handling)

### Infrastructure
- ✅ CKB testnet connectivity verified
- ✅ Development environment reproducible
- ✅ CI/CD pipeline planned (GitHub Actions)

---

## Challenges Encountered

### Challenge 1: Lumos SDK Learning Curve
**Issue**: Lumos documentation less comprehensive than ckb-sdk-core  
**Resolution**: Combined Lumos docs with community examples and CKB documentation  
**Impact**: 2-day delay in initial setup

### Challenge 2: Transaction Structure
**Issue**: Determining optimal cell structure for hash storage  
**Resolution**: Decided on simple data-only cells with minimal metadata  
**Impact**: None, resolved during planning phase

### Challenge 3: TypeScript Configuration
**Issue**: Shared types between frontend and backend  
**Resolution**: Created shared types package (to be implemented in Milestone 2)  
**Impact**: Improved type safety planning

---

## Metrics

### Time Allocation
- Requirements & Planning: 3 days
- Repository Setup: 1 day
- CKB Configuration: 2 days
- Documentation: 2 days
- Buffer: 2 days
- **Total**: 10 days (within 2-week milestone)

### Code Metrics
- Lines of Code: ~500 (configuration and setup)
- Files Created: 25+
- Documentation Pages: 4

---

## Next Milestone Preview

**Milestone 2 Goals** (Weeks 3-4):
1. Implement local hashing logic (browser-side)
2. Define hash submission data schema
3. Implement CKB anchoring logic
4. Test transaction creation on testnet
5. Complete basic API endpoints

**Dependencies**:
- CKB testnet account funded (✅ Complete)
- Development environment set up (✅ Complete)

---

## Sign-Off

**Status**: Milestone 1 Complete ✅  
**Ready for Milestone 2**: Yes  
**Blockers**: None  

**Team Notes**:
- Foundation is solid for rapid development in next phases
- CKB testnet integration verified and working
- TypeScript setup will prevent many runtime errors

---

**Next Review**: End of Milestone 2 (Week 4)
