import { Journey } from './activity';
import { Stats } from './checkins';
import { api } from './client';
import { Gym } from './gyms';
import { NotificationList } from './notifications';
import { UserProfile } from './users';

/**
 * Everything the Home screen shows, fetched in one request. Each field has the
 * same shape as its own endpoint, so it can seed that endpoint's query cache.
 */
export type Home = {
  stats: Stats;
  gym: Gym | null;
  journey: Journey;
  notifications: NotificationList;
  profile: UserProfile;
};

export async function getHome(): Promise<Home> {
  const { data } = await api.get<Home>('/home');
  return data;
}
