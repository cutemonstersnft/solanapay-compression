import { createQR, encodeURL, TransferRequestURLFields, findReference, validateTransfer, FindReferenceError, ValidateTransferError, TransactionRequestURLFields } from "@solana/pay";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl, Connection, Keypair } from "@solana/web3.js";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeading from "../components/PageHeading";
import calculatePrice from "../lib/calculatePrice";


export default function Checkout() {
  const router = useRouter()

  const qrRef = useRef<HTMLDivElement>(null)

  const amount = useMemo(() => calculatePrice(router.query), [router.query])

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(router.query)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) {
          searchParams.append(key, v);
        }
      } else {
        searchParams.append(key, value);
      }
    }
  }

  const reference = useMemo(() => Keypair.generate().publicKey, []);

  // Add it to the params we'll pass to the API
  searchParams.append('reference', reference.toString());

  const connection = new Connection('https://api.devnet.solana.com')
  
  // Show the QR code
  const [solanaUrl, setSolanaUrl] = useState('');
  // Show the QR code
  useEffect(() => {
    // window.location is only available in the browser, so create the URL in here
    const { location } = window
    const apiUrl = `${location.protocol}//${location.host}/api/pay?${searchParams.toString()}`
    const urlParams: TransactionRequestURLFields = {
      link: new URL(apiUrl),
    }
    const solanaUrl = encodeURL(urlParams)
    setSolanaUrl(solanaUrl.toString());
    const qr = createQR(solanaUrl, 350, 'transparent')
    if (qrRef.current) {
      qrRef.current.innerHTML = ''
      qr.append(qrRef.current)
    }
    
  })

  // Check every 0.5s if the transaction is completed
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Check if there is any transaction for the reference
        const signatureInfo = await findReference(connection, reference, { finality: 'confirmed' })
        // Navigate to the confirmed page if no errors are thrown
        router.push('/confirmed')
      } catch (e) {
        if (e instanceof FindReferenceError) {
          // No transaction found yet, ignore this error
          return;
        }
        console.error('Unknown error', e)
      }
    }, 500)
    return () => {
      clearInterval(interval)
    }
  }, [])


  return (
    <div className="flex flex-col items-center px-2">
      <div className="mt-8">
        <PageHeading>Payment Initiated...</PageHeading>
      </div>
      <h3 className="text-4xl text-center font-bold text-white px-4 mt-4">
        Scan QR Code
      </h3>
      <h3 className="text-3xl text-center font-light text-white px-4 my-2">
        to Pay with Mobile Wallet
      </h3>
      <div
        className="bg-blue-100 rounded-3xl border-4 border-red-500"
        ref={qrRef}
        onClick={() => (window.location.href = solanaUrl)}
        style={{ cursor: "pointer" }}
      />
    </div>
  );
}