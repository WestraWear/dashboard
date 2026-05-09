export interface Product {
  id: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  price: number;
  original_price?: number;
  sizes: string[];
  tags: string[];
  in_stock: boolean;
  image_placeholder: string;
}
