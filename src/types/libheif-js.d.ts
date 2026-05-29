declare module "libheif-js" {
  interface HeifPixelData {
    data: Uint8ClampedArray;
  }

  interface HeifImage {
    get_width(): number;
    get_height(): number;
    is_primary(): boolean;
    display(
      pixelData: HeifPixelData,
      callback: (result: HeifPixelData | null) => void,
    ): void;
    free(): void;
  }

  class HeifDecoder {
    constructor();
    decode(buffer: ArrayBuffer): HeifImage[];
  }
}
