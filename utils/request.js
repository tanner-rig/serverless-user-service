import { SERVICE_API_KEY } from '../constants';

export function getOptions() {
  return {
    headers: {
      'Service-API-Key': SERVICE_API_KEY
    }
  };
}
