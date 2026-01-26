import api from './api';

export interface Place {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone: string;
  website: string;
  formatted_address: string;
}

export interface PlacesSearchResponse {
  places: Place[];
}

export const placesService = {
  search: async (query: string, near?: string): Promise<Place[]> => {
    const params = new URLSearchParams({ query });
    if (near) {
      params.append('near', near);
    }
    const response = await api.get<PlacesSearchResponse>(`/places/search?${params.toString()}`);
    return response.data.places;
  },
};
