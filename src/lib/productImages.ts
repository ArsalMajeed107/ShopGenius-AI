import heroImg from "../assets/images/hero_ai_shopping_1794663304572.jpg";
import laptopProImg from "../assets/images/product_laptop_pro_1794663304640.jpg";
import smartphoneImg from "../assets/images/product_smartphone_flagship_1794663304551.jpg";
import headphonesImg from "../assets/images/product_audio_headphones_1794663305171.jpg";
import watchImg from "../assets/images/product_watch_wearable_1794663305914.jpg";
import cameraImg from "../assets/images/product_camera_smarthome_1794663305609.jpg";
import gamingLaptopImg from "../assets/images/product_gaming_laptop_1794663305691.jpg";
import earbudsImg from "../assets/images/product_earbuds_compact_1794663307841.jpg";

export const PRODUCT_IMAGE_MAP: Record<string, string> = {
  hero: heroImg,
  laptop_pro: laptopProImg,
  smartphone: smartphoneImg,
  headphones: headphonesImg,
  watch: watchImg,
  camera: cameraImg,
  gaming_laptop: gamingLaptopImg,
  earbuds: earbudsImg,
};

export function resolveProductImage(key: string): string {
  return PRODUCT_IMAGE_MAP[key] || PRODUCT_IMAGE_MAP.laptop_pro;
}
