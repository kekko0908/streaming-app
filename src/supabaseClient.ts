import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://tugrllyzxyqejlblmlnh.supabase.co";
const supabaseKey = "sb_publishable_ieDGdI4DqvjjqMPFgSBa6Q_cBpCcbMm";

export const supabase = createClient(supabaseUrl, supabaseKey);