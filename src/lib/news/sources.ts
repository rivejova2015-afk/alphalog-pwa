export type Asset = "US500" | "XAUUSD";

export type NewsSource = {
  id: string;
  name: string;
  url: string;
  assets: Asset[];
};

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "fed_press_monetary",
    name: "Federal Reserve - Monetary Policy Press Releases",
    url: "https://www.federalreserve.gov/feeds/press_monetary.xml",
    assets: ["US500", "XAUUSD"],
  },
  {
    id: "bls_employment",
    name: "BLS - Employment Situation",
    url: "https://www.bls.gov/feed/empsit.rss",
    assets: ["US500", "XAUUSD"],
  },
  {
    id: "bls_cpi",
    name: "BLS - Consumer Price Index (CPI)",
    url: "https://www.bls.gov/feed/cpi.rss",
    assets: ["US500", "XAUUSD"],
  },
  {
    id: "bls_ppi",
    name: "BLS - Producer Price Index (PPI)",
    url: "https://www.bls.gov/feed/ppi.rss",
    assets: ["US500", "XAUUSD"],
  },
  {
    id: "sec_press",
    name: "SEC - Press Releases",
    url: "https://www.sec.gov/news/pressreleases.rss",
    assets: ["US500"],
  },
  {
    id: "bis_press",
    name: "BIS - Press Releases",
    url: "https://www.bis.org/doclist/rss_all_press_releases.rss",
    assets: ["US500", "XAUUSD"],
  },
  {
    id: "treasurydirect_offerings",
    name: "TreasuryDirect - Treasury Offering Announcements",
    url: "https://treasurydirect.gov/TA_WS/securities/announcerss.xml",
    assets: ["US500", "XAUUSD"],
  },
  {
    id: "treasurydirect_auctions",
    name: "TreasuryDirect - Auction Results",
    url: "https://treasurydirect.gov/TA_WS/securities/auctionsrss.xml",
    assets: ["US500", "XAUUSD"],
  },
];

export const getSourcesForAsset = (asset: Asset) =>
  NEWS_SOURCES.filter((source) => source.assets.includes(asset));
