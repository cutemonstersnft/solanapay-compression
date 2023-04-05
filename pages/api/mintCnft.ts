import type { NextApiRequest, NextApiResponse } from "next";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import { findReference } from "@solana/pay";
import {
  MetadataArgs,
  TokenProgramVersion,
  TokenStandard,
} from "@metaplex-foundation/mpl-bubblegum";
import { mintCompressedNFT } from "../../utils/compression";

interface ResponseData {
  data?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const apiSecret = process.env.API_SECRET;

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${apiSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = req.body;
  const reference = new PublicKey(body.reference);
  const buyerPublicKey = new PublicKey(body.account);
  // Define a function to execute the code that needs to be run periodically

  async function executeMintCNFT(retries: number) {
    const connection = new Connection("https://api.devnet.solana.com/");
    const signatureInfo = await findReference(connection, reference, {
      finality: "confirmed",
    });

    if (signatureInfo) {
      console.log("Signature info found. minting cNFT...");

      const shopPrivateKey = process.env.OP_PRIVATE_KEY as string
      const shopKeypair = Keypair.fromSecretKey(base58.decode(shopPrivateKey));
      const shopPublicKey = shopKeypair.publicKey;

      const connection = new Connection("https://api.devnet.solana.com/");

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

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
      const treePub = new PublicKey(
        "J2WovQXXJuNUPvU3eNsCwyhakLfePVDZRvy6WQckW9GF"
      );

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

      const message = "Operation completed successfully";
      res.json({ data: message });
    } else if (retries > 0) {
      // Retry after a delay if there are remaining retries
      timeoutId = setTimeout(() => executeMintCNFT(retries - 1), 10000);
    } else {
      // Return an error message if no retries are left
      res.status(404).json({ error: "Reference not found" });
    }
  }

  // Execute the function once, after 10 seconds, with a maximum of 3 attempts
  const maxRetries = 3;
  let timeoutId = setTimeout(() => executeMintCNFT(maxRetries - 1), 10000);
}
