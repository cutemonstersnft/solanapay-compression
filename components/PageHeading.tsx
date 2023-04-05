import { PropsWithChildren } from "react";

export default function PageHeading({ children }: PropsWithChildren<{}>) {
  return <h3 className="text-4xl text-center font-light text-white px-4 mt-8">{children}</h3>
}
