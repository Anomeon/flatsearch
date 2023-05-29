import * as TR from 'utils/tr-texts';

export type Marker = {
  id: string;
  lat: number;
  lon: number;
  price: number;
  location: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  attributes: {
    [TR.AREA_FIELD]: string;
    [TR.SIZE_FIELD]: string;
    [TR.FLOOR_FIELD]: string;
  },
}

export type MarkersResponse = {
  paging: {
    totalResults: number;
  },
  classifiedMarkers: Marker[];
}
