import { redirect } from "next/navigation";

export default function RootPage() {
  if (process.env.MANDEGAR_STATIC_EXPORT === "1") {
    const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const basePath = configuredBasePath === "/"
      ? ""
      : `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`;
    const destination = `${basePath}/fa/`;
    return (
      <main>
        <meta httpEquiv="refresh" content={`0;url=${destination}`} />
        <script dangerouslySetInnerHTML={{ __html: `window.location.replace(${JSON.stringify(destination)});` }} />
        <a href={destination}>Continue to Mandegar</a>
      </main>
    );
  }
  redirect("/fa");
}
