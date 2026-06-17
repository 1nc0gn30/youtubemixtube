import type { Config, Context } from "@netlify/functions";
import yts from "yt-search";

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

export default async (req: Request, context: Context) => {
  try {
    const url = new URL(req.url);
    const requestedGenres = url.searchParams.get("genres")?.split(",").map(g => g.trim()).filter(Boolean) || [];
    const requestedArtists = url.searchParams.get("artists")?.split(",").map(a => a.trim()).filter(Boolean) || [];
    const mode = url.searchParams.get("mode") || "mix";

    let seed = SEEDS[Math.floor(Math.random() * SEEDS.length)];
    
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
      seed = SEEDS[Math.floor(Math.random() * SEEDS.length)];
    } else if (mode === "lucky") {
      seed = OBSCURE_SEEDS[Math.floor(Math.random() * OBSCURE_SEEDS.length)];
    } else if (mode === "trending") {
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
        seed = SEEDS[Math.floor(Math.random() * SEEDS.length)];
      }
    }

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
          image: `https://img.youtube.com/vi/${v.videoId}/maxresdefault.jpg`,
          fallback: v.thumbnail
        });

        // Limit batch size so we don't drain the pool too fast
        if (newThumbnails.length >= 10) {
          break;
        }
      }
    }

    // Clear history if it gets too large
    if (seenVideos.size > 500) {
      seenVideos.clear();
    }

    return new Response(JSON.stringify({ thumbnails: newThumbnails }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (error) {
    console.error("Error fetching thumbnails:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch thumbnails" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    });
  }
};

export const config: Config = {
  path: "/api/thumbnails"
};
