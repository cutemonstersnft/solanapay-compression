import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  Transaction,
  clusterApiUrl,
  AccountMeta,
  TransactionInstruction,
} from "@solana/web3.js";
import { NextApiRequest, NextApiResponse } from "next";
import { usdcAddress } from "../../lib/addresses";
import base58 from "bs58";
import {
  ConcurrentMerkleTreeAccount,
  MerkleTreeProof,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from "@solana/spl-account-compression";
import {
  PROGRAM_ID as BUBBLEGUM_PROGRAM_ID,
  createTransferInstruction,
} from "@metaplex-foundation/mpl-bubblegum";
// local import of the connection wrapper, to help with using the ReadApi
import { WrapperConnection } from "../../ReadApi/WrapperConnection";

export type MakeTransactionInputData = {
  account: string,
};

type MakeTransactionGetResponse = {
  label: string,
  icon: string,
};

export type MakeTransactionOutputData = {
  transaction: string,
  message: string,
};

type ErrorOutput = {
  error: string,
};

function get(res: NextApiResponse<MakeTransactionGetResponse>) {
  res.status(200).json({
    label: "Monstrè Pay",
    icon: "https://shdw-drive.genesysgo.net/HcnRQ2WJHfJzSgPrs4pPtEkiQjYTu1Bf6DmMns1yEWr8/monstre%20logo.png",
  });
}

async function post(
  req: NextApiRequest,
  res: NextApiResponse<MakeTransactionOutputData | ErrorOutput>
) {
  try {
    
    // We pass the selected items in the query, calculate the expected cost
    const amount = parseFloat(req.query.amount as string);
    console.log(amount);

    // We pass the buyer's public key in JSON body
    const { account } = req.body as MakeTransactionInputData
    if (!account) {
      res.status(40).json({ error: "No account provided" });
      return;
    }

    // We pass the reference to use in the query
    const { reference } = req.query;
    if (!reference) {
      res.status(400).json({ error: "No reference provided" });
      return;
    }

    // We get the shop private key from .env - this is the same as in our script
    const shopPrivateKey = process.env.OP_PRIVATE_KEY as string
    if (!shopPrivateKey) {
      res.status(500).json({ error: "Shop private key not available" });
    }

    const shopKeypair = Keypair.fromSecretKey(base58.decode(shopPrivateKey));

    const buyerPublicKey = new PublicKey(account);
    const shopPublicKey = shopKeypair.publicKey;

    // load the env variables and store the cluster RPC url
    const CLUSTER_URL = process.env.RPC_URL ?? clusterApiUrl("devnet");

    // create a new rpc connection, using the ReadApi wrapper
    const connection = new WrapperConnection(CLUSTER_URL);

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const treePub = new PublicKey(
      "J2WovQXXJuNUPvU3eNsCwyhakLfePVDZRvy6WQckW9GF"
    );

    const [bubblegumSigner, _bump2] = PublicKey.findProgramAddressSync(
      // `collection_cpi` is a custom prefix required by the Bubblegum program
      [Buffer.from("collection_cpi", "utf8")],
      BUBBLEGUM_PROGRAM_ID
    );

    const [treeAuthority, _bump] = PublicKey.findProgramAddressSync(
      [treePub.toBuffer()],
      BUBBLEGUM_PROGRAM_ID
    );

    const assets = await connection.getAssetsByOwner({
      ownerAddress: buyerPublicKey.toBase58(),
    });

    console.log("Total assets returned:", assets.total);

    const filteredAssets = assets.items.filter(
      (asset) => asset.compression.tree === treePub.toBase58()
    );
    let assetId; // Declare assetId variable here
    let transferIx: TransactionInstruction | undefined;
    if (filteredAssets.length > 0) {
      const singleAsset = filteredAssets[0];
      assetId = new PublicKey(singleAsset.id); // Update assetId variable
      console.log("Asset ID:", assetId.toBase58());

      const asset = await connection.getAsset(assetId);
      const assetProof = await connection.getAssetProof(assetId);
      const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
        connection,
        treePub
      );

      const merkleTreeProof: MerkleTreeProof = {
        leafIndex: asset.compression.leaf_id,
        leaf: new PublicKey(assetProof.leaf).toBuffer(),
        root: new PublicKey(assetProof.root).toBuffer(),
        proof: assetProof.proof.map((node: string) =>
          new PublicKey(node).toBuffer()
        ),
      };

      const currentRoot = treeAccount.getCurrentRoot();
      const rpcRoot = new PublicKey(assetProof.root).toBuffer();
      const newLeafOwner = shopPublicKey;
      // set the current leafOwner (aka the current owner of the NFT)
      const canopyDepth = treeAccount.getCanopyDepth();

      // parse the list of proof addresses into a valid AccountMeta[]
      const proofPath: AccountMeta[] = assetProof.proof
        .map((node: string) => ({
          pubkey: new PublicKey(node),
          isSigner: false,
          isWritable: false,
        }))
        .slice(0, assetProof.proof.length - (!!canopyDepth ? canopyDepth : 0));

      // set the current leafDelegate
      const leafDelegate = !!asset.ownership?.delegate
        ? new PublicKey(asset.ownership.delegate)
        : buyerPublicKey;

      const leafOwner = new PublicKey(asset.ownership.owner);

      transferIx = createTransferInstruction(
        {
          merkleTree: treePub,
          treeAuthority,
          leafOwner,
          leafDelegate,
          newLeafOwner,
          logWrapper: SPL_NOOP_PROGRAM_ID,
          compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
          anchorRemainingAccounts: proofPath,
        },
        {
          root: Array.from(new PublicKey(assetProof.root.trim()).toBytes()),
          dataHash: Array.from(
            new PublicKey(asset.compression.data_hash.trim()).toBytes()
          ),
          creatorHash: Array.from(
            new PublicKey(asset.compression.creator_hash.trim()).toBytes()
          ),
          nonce: asset.compression.leaf_id,
          index: asset.compression.leaf_id,
        },
        BUBBLEGUM_PROGRAM_ID
      );
    } else {
      console.log("No assets found");
    }

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

    const amountToPay = filteredAssets.length > 0 ? 0 : amount;

    // Create the instruction to send USDC from the buyer to the shop
    const transferInstruction = createTransferCheckedInstruction(
      buyerUsdcAddress, // source
      usdcAddress, // mint (token address)
      shopUsdcAddress, // destination
      buyerPublicKey, // owner of source address
      amountToPay * 10 ** usdcMint.decimals, // amount to transfer (in units of the USDC token)
      usdcMint.decimals // decimals of the USDC token
    );

    // Add the reference to the instruction as a key
    // This will mean this transaction is returned when we query for the reference

    transferInstruction.keys.push({
      pubkey: new PublicKey(reference),
      isSigner: false,
      isWritable: false,
    });

    const transaction2 = new Transaction({
      feePayer: shopPublicKey,
      blockhash,
      lastValidBlockHeight,
    });

    // Add both instructions to the transaction
    transaction.add(transferInstruction);
    // Add both instructions to the transaction
    if (transferIx !== undefined) {
      transaction2.add(transferInstruction, transferIx);
    }

    // Sign the transaction as the shop, which is required to transfer the compressed NFT
    // We must partial sign because the transfer instruction still requires the user
    let selectedTransaction;
    if (filteredAssets.length > 0) {
      selectedTransaction = transaction2;
    } else {
      selectedTransaction = transaction;
    }

    // Sign the selected transaction as the shop
    selectedTransaction.partialSign(shopKeypair);

    // Serialize the selected transaction and convert to base64 to return it
    const serializedTransaction = selectedTransaction.serialize({
      // We will need the buyer to sign this transaction after it's returned to them
      requireAllSignatures: false,
    });
    const base64 = serializedTransaction.toString("base64");
    const message = "Powered by Monstrè! 👾";

    // Return the serialized transaction
    res.status(200).json({
      transaction: base64,
      message,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({ error: "error creating transaction" });
    return;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    MakeTransactionGetResponse | MakeTransactionOutputData | ErrorOutput
  >
) {
  if (req.method === "GET") {
    return get(res);
  } else if (req.method === "POST") {
    return await post(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
