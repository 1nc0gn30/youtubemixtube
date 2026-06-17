import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  try {
    const requestUrl = new URL(req.url);
    const url = requestUrl.searchParams.get("url");
    const fallbackUrl = requestUrl.searchParams.get("fallback");

    if (!url) {
      return new Response("URL is required", { status: 400 });
    }

    let response = await fetch(url);

    // If the primary image fails, try the fallback
    if (!response.ok) {
      if (fallbackUrl) {
        response = await fetch(fallbackUrl);
      } else if (url.includes("maxresdefault.jpg")) {
        // Automatic YouTube fallback
        const autoFallback = url.replace("maxresdefault.jpg", "hqdefault.jpg");
        response = await fetch(autoFallback);
        if (!response.ok) {
          response = await fetch(url.replace("maxresdefault.jpg", "mqdefault.jpg"));
        }
      }
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache for 1 day
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (error: any) {
    console.error("Image proxy error:", error);
    return new Response("Error proxying image: " + error.message, { 
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      }
    });
  }
};

export const config: Config = {
  path: "/api/image-proxy"
};
