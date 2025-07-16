-- Allow unauthenticated sign-ups (anon role) to run the RPC
GRANT EXECUTE ON FUNCTION create_profile_for_user(UUID, TEXT, TEXT, TEXT) TO anon;
