# WebRTC signaling using CouchDB

## Motivation
This project pretends to be a solution for achieve peer connections using WebRTC keeping it simple and decentralized.
Using CouchDB allows to easily mount a signaling server, publicly available to perform the SDP exchange.

## Tools
- CouchDB
- Vite/Vue
- PouchDB 


## Setup CouchDB
```commandline
docker-compompose up -d
```
```commandline
npm run setup
```

## Run web server
```commandline
npm run dev
```

## Build
```commandline
npm run build
```
