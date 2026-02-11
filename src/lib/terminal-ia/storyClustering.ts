// Story Clustering IA
// Agrupa noticias repetidas en “historias” y genera un reporte limpio.

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  topic: string;
  date: Date;
}

export interface StoryCluster {
  topic: string;
  items: NewsItem[];
}

export function clusterStories(news: NewsItem[]): StoryCluster[] {
  const clusters: Record<string, StoryCluster> = {};
  for (const item of news) {
    if (!clusters[item.topic]) clusters[item.topic] = { topic: item.topic, items: [] };
    clusters[item.topic].items.push(item);
  }
  return Object.values(clusters);
}
