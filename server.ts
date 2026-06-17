import express from "express";
import path from "path";
import yts from "yt-search";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Algorithm seeds
const SEEDS = [
  "top music videos 2024",
  "vevo hot this week",
  "hip hop music video",
  "pop music video",
  "kpop official mv",
  "latin top hits mv",
  "r&b official video",
  "electronic music video",
  "indie rock mv",
  "afrobeats official",
];

// Memory to ensure we never repeat images in the session
const seenVideos = new Set<string>();

async function startServer() {
  const app = express();

  app.get("/api/thumbnails", async (req, res) => {
    try {
      let seed = SEEDS[Math.floor(Math.random() * SEEDS.length)];
      
      const requestedGenres = (req.query.genres as string)?.split(",").map(g => g.trim()).filter(Boolean) || [];
      const requestedArtists = (req.query.artists as string)?.split(",").map(a => a.trim()).filter(Boolean) || [];
      const mode = (req.query.mode as string) || "mix";

      let customPool: string[] = [];
      if (requestedGenres.length > 0) {
        customPool.push(...requestedGenres.map(g => `${g} official music video`));
      }
      if (requestedArtists.length > 0) {
        customPool.push(...requestedArtists.map(a => `${a} official music video`));
      }

      const OBSCURE_SEEDS = [
        "vaporwave aesthetic visuals tape",
        "experimental math rock live",
        "underground noise music video",
        "obscure soviet synthpop",
        "dark ambient drone visuals",
        "japanese city pop 80s mv",
        "wonky beats obscure",
        "post-punk obscure live",
      ];
      
      const TRENDING_SEEDS = [
        "trending music video 2024",
        "billboard hot 100 official video",
        "top hits this week mv",
        "global top 50 music video",
      ];

      if (mode === "shuffle") {
        // Completely random from standard seeds, ignore preferences
        seed = SEEDS[Math.floor(Math.random() * SEEDS.length)];
      } else if (mode === "lucky") {
        // Obscure / very different seeds
        seed = OBSCURE_SEEDS[Math.floor(Math.random() * OBSCURE_SEEDS.length)];
      } else if (mode === "trending") {
        // strictly top charting
        seed = TRENDING_SEEDS[Math.floor(Math.random() * TRENDING_SEEDS.length)];
      } else {
        // mode === "mix" (Default)
        if (customPool.length > 0) {
          // 80% chance to use user preference, 20% standard seed mix
          if (Math.random() < 0.8) {
            seed = customPool[Math.floor(Math.random() * customPool.length)];
          } else {
            seed = SEEDS[Math.floor(Math.random() * SEEDS.length)];
          }
        } else {
          // Fallback to standard seeds if no preference given
          seed = SEEDS[Math.floor(Math.random() * SEEDS.length)];
        }
      }

      // Equation: Pick a seed, append " 4k" or " hd" for better quality
      const qualitySuffix = Math.random() > 0.5 ? " 4k" : " hd";
      const searchQuery = `${seed}${qualitySuffix}`;

      const searchResult = await yts(searchQuery);
      
      // Shuffle the videos using an algorithmic sort
      let videos = searchResult.videos.sort(() => Math.random() - 0.5);

      const newThumbnails = [];

      for (const v of videos) {
        if (!seenVideos.has(v.videoId)) {
          seenVideos.add(v.videoId);
          
          newThumbnails.push({
            id: v.videoId,
            title: v.title,
            author: v.author?.name || "Unknown Artist",
            // Highest resolution thumbnail format for YouTube
            image: `https://img.youtube.com/vi/${v.videoId}/maxresdefault.jpg`,
            fallback: v.thumbnail // Usually hqdefault.jpg
          });

          // Limit batch size so we don't drain the pool too fast
          if (newThumbnails.length >= 10) {
            break;
          }
        }
      }

      res.json({ thumbnails: newThumbnails });
    } catch (error) {
      console.error("Error fetching thumbnails:", error);
      res.status(500).json({ error: "Failed to fetch thumbnails" });
    }
  });

  app.get("/api/image-proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      const fallbackUrl = req.query.fallback as string;
      
      if (!url) {
        return res.status(400).send("URL is required");
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
      const buffer = Buffer.from(arrayBuffer);
      
      const contentType = response.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400"); // Cache it
      res.send(buffer);
    } catch (error) {
      console.error("Image proxy error:", error);
      res.status(500).send("Error proxying image");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
