import { createTransferCheckedInstruction, getAssociatedTokenAddress, getMint, getOrCreateAssociatedTokenAccount } from "@solana/spl-token"
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js"
import { NextApiRequest, NextApiResponse } from "next"
import { usdcAddress } from "../../lib/addresses"
import base58 from 'bs58'
import {
  MetadataArgs,
  TokenProgramVersion,
  TokenStandard,
} from "@metaplex-foundation/mpl-bubblegum";

// import custom helpers to mint compressed NFTs
import { mintCompressedNFT } from "../../utils/compression";

export type MakeTransactionInputData = {
  account: string,
}

type MakeTransactionGetResponse = {
  label: string,
  icon: string,
}

export type MakeTransactionOutputData = {
  transaction: string,
  message: string,
}

type ErrorOutput = {
  error: string
}

function get(res: NextApiResponse<MakeTransactionGetResponse>) {
  res.status(200).json({
    label: "Monstrè Pay",
    icon: "https://shdw-drive.genesysgo.net/HcnRQ2WJHfJzSgPrs4pPtEkiQjYTu1Bf6DmMns1yEWr8/monstre%20logo.png",
  })
}

async function post(
  req: NextApiRequest,
  res: NextApiResponse<MakeTransactionOutputData | ErrorOutput>
) {
  try {
    // We pass the selected items in the query, calculate the expected cost
    const amount = parseFloat(req.query.amount as string);
    console.log(amount)
  
    // We pass the buyer's public key in JSON body
    const { account } = req.body as MakeTransactionInputData
    if (!account) {
      res.status(40).json({ error: "No account provided" })
      return
    }

    // We pass the reference to use in the query
    const { reference } = req.query
    if (!reference) {
      res.status(400).json({ error: "No reference provided" })
      return
    }

    // We get the shop private key from .env - this is the same as in our script
    const shopPrivateKey = process.env.OP_PRIVATE_KEY as string
    if (!shopPrivateKey) {
      res.status(500).json({ error: "Shop private key not available" })
    }
    const shopKeypair = Keypair.fromSecretKey(base58.decode(shopPrivateKey));

const buyerPublicKey = new PublicKey(account);
const shopPublicKey = shopKeypair.publicKey;
console.log(shopPublicKey);

const connection = new Connection("https://api.devnet.solana.com");

const { blockhash, lastValidBlockHeight } =
  await connection.getLatestBlockhash();

const transaction = new Transaction({
  feePayer: shopPublicKey,
  blockhash,
  lastValidBlockHeight,
});

// Get details about the USDC token
const usdcMint = await getMint(connection, usdcAddress);
// Get the buyer's USDC token account address
const buyerUsdcAddress = await getAssociatedTokenAddress(
  usdcAddress,
  buyerPublicKey
);
// Get the shop's USDC token account address
const shopUsdcAddress = await getAssociatedTokenAddress(
  usdcAddress,
  shopPublicKey
);

// Create the instruction to send USDC from the buyer to the shop
const transferInstruction = createTransferCheckedInstruction(
  buyerUsdcAddress, // source
  usdcAddress, // mint (token address)
  shopUsdcAddress, // destination
  buyerPublicKey, // owner of source address
  amount * 10 ** usdcMint.decimals, // amount to transfer (in units of the USDC token)
  usdcMint.decimals // decimals of the USDC token
);

// Add the reference to the instruction as a key
// This will mean this transaction is returned when we query for the reference

transferInstruction.keys.push({
  pubkey: new PublicKey(reference),
  isSigner: false,
  isWritable: false,
});

let initBalance: number, balance: number;

// generate a new Keypair for testing, named `wallet`
const testWallet = Keypair.generate();

const compressedNFTMetadata: MetadataArgs = {
  name: "Monstrè Compressed NFT",
  symbol: "LEM",
  // specific json metadata for each NFT
  uri: "https://shdw-drive.genesysgo.net/HcnRQ2WJHfJzSgPrs4pPtEkiQjYTu1Bf6DmMns1yEWr8/2.json",
  creators: [
    {
      address: shopPublicKey,
      verified: false,
      share: 100,
    },
    {
      address: testWallet.publicKey,
      verified: false,
      share: 0,
    },
  ], // or set to null
  editionNonce: 0,
  uses: null,
  collection: null,
  primarySaleHappened: false,
  sellerFeeBasisPoints: 0,
  isMutable: false,
  // these values are taken from the Bubblegum package
  tokenProgramVersion: TokenProgramVersion.Original,
  tokenStandard: TokenStandard.NonFungible,
};

const collectionMint = new PublicKey(
  "GyErp3uPewz3Jd7AcC2pTeJfsZuy3P9MXCcnfyBkChRu"
);
const metadataAccount = new PublicKey(
  "A4f1gMw9wU7qojV92AmovATdnrw92HbHoTsfocL2nmfr"
);
const masterEditionAccount = new PublicKey(
  "BvHzAsdGjbRP6CerN3re5t54DTLCFCUucXjYqs4e4TaP"
);
const treePub = new PublicKey("J2WovQXXJuNUPvU3eNsCwyhakLfePVDZRvy6WQckW9GF");

if (amount > 10) {
  await mintCompressedNFT(
    connection,
    shopKeypair,
    treePub,
    collectionMint,
    metadataAccount,
    masterEditionAccount,
    compressedNFTMetadata,
    // mint to this specific wallet (in this case, airdrop to `testWallet`)
    buyerPublicKey
  );
}

// Add both instructions to the transaction
transaction.add(transferInstruction);

// Sign the transaction as the shop, which is required to transfer the coupon
// We must partial sign because the transfer instruction still requires the user
transaction.partialSign(shopKeypair);

// Serialize the transaction and convert to base64 to return it
const serializedTransaction = transaction.serialize({
  // We will need the buyer to sign this transaction after it's returned to them
  requireAllSignatures: false,
});
const base64 = serializedTransaction.toString("base64");

// Insert into database: reference, amount

const message = "Powered by Monstrè! 👾";


    // Return the serialized transaction
    res.status(200).json({
      transaction: base64,
      message,
    })
  } catch (err) {
    console.error(err);

    res.status(500).json({ error: 'error creating transaction', })
    return
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MakeTransactionGetResponse | MakeTransactionOutputData | ErrorOutput>
) {
  if (req.method === "GET") {
    return get(res)
  } else if (req.method === "POST") {
    return await post(req, res)
  } else {
    return res.status(405).json({ error: "Method not allowed" })
  }
}