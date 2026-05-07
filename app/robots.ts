import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/login',
          '/register',
          '/profile',
          '/games/', // private game rooms — no crawl
        ],
      },
    ],
    sitemap: 'https://bodega-bets.com/sitemap.xml',
    host: 'https://bodega-bets.com',
  }
}
