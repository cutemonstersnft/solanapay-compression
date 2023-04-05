import { useRef } from "react";
import { products } from "../lib/products"

interface Props {
  submitTarget: string;
  enabled: boolean;
}

export default function Products({ submitTarget, enabled }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form method="get" action={submitTarget} ref={formRef}>
      <div className="flex justify-center items-center h-screen px-4">
    <div className="w-full max-w-sm p-4 px-8 bg-white border border-gray-100 rounded-2xl shadow sm:p-6 md:p-8 dark:bg-gray-800 dark:border-gray-700">
          <div>
            {products.map((product) => {
              return (
                
                <div
                  className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white"
                  key={product.id}
                ><img className="h-6 mt-1" src="/monstre.png" alt="monstrelogo"></img>
                  <h5 className="mt-4 text-3xl font-medium text-gray-900 dark:text-white">
                    Checkout
                  </h5>
                  <div>
                    <div className="block mb-2 mt-4 text-sm font-medium text-gray-900 dark:text-white">
                      <label>Amount :</label>
                    </div>
                    <input
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                      type="number"
                      id="amount"
                      name="amount"
                      placeholder="8 USDC"
                      step="0.01"
                    />
                  </div>
                </div>
              );
            })}
            <button className="flex items-center justify-center w-full mt-4 mb-2 text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-md px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
              Pay With
              <img className="h-4 ml-2 mt-1" src="/solanapay.png" alt="solanapay"></img>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}  