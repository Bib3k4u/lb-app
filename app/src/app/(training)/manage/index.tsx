/** The correct operational landing page for the grants this account holds. */
import { Redirect } from 'expo-router';
import AdminHome from '../../(admin)/index';
import TrainerHome from '../../(trainer)/index';
import SuperAdminHome from '../../(superadmin)/index';
import { useAuth, visibleSections } from '../../../lib/auth/store';

export default function ManageHome() {
  const user = useAuth((state) => state.user);
  if (!user) return <Redirect href="/(auth)/identifier" />;

  const sections = visibleSections(user);
  if (sections.superadmin) return <SuperAdminHome />;
  if (sections.admin) return <AdminHome />;
  if (sections.trainer) return <TrainerHome />;
  return <Redirect href="/(training)/today" />;
}
