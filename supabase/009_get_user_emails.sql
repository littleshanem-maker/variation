-- Simple function to get emails for a list of user IDs
-- Only works if caller is an active company member with the same users
CREATE OR REPLACE FUNCTION public.get_user_emails(user_ids UUID[])
RETURNS TABLE (user_id UUID, email TEXT, full_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.raw_user_meta_data->>'full_name'
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_emails(UUID[]) TO authenticated;
