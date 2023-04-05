import { Connection } from "@solana/web3.js"

const mainnetConnection = new Connection(`https://${process.env.MAINNET_RPC as string}`)

export default mainnetConnection