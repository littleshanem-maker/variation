const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('/Users/shanelittle/dev/variation/.env.local', 'utf8');
const getEnv = (k) => { const m = env.match(new RegExp(`${k}="?([^"\n]+)`)); return m?.[1]; };

const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'));

function uid() { return require('crypto').randomUUID(); }

const costSets = {
  labour_heavy: (val) => [
    { id: uid(), description: 'Leading hand — supervision & coordination', qty: Math.round(val*0.3/115), unit: 'hrs', rate: 115, total: Math.round(val*0.3/115)*115 },
    { id: uid(), description: 'Tradesperson — installation works', qty: Math.round(val*0.4/95), unit: 'hrs', rate: 95, total: Math.round(val*0.4/95)*95 },
    { id: uid(), description: 'Labourer — materials handling & site clean', qty: Math.round(val*0.15/75), unit: 'hrs', rate: 75, total: Math.round(val*0.15/75)*75 },
    { id: uid(), description: 'Materials & consumables', qty: 1, unit: 'lot', rate: Math.round(val*0.1), total: Math.round(val*0.1) },
    { id: uid(), description: 'Plant & equipment allowance', qty: 1, unit: 'lot', rate: Math.round(val*0.05), total: Math.round(val*0.05) },
  ],
  materials_heavy: (val) => [
    { id: uid(), description: 'Pipe, fittings & valves supply', qty: 1, unit: 'lot', rate: Math.round(val*0.45), total: Math.round(val*0.45) },
    { id: uid(), description: 'Sprinkler heads / suppression components', qty: 1, unit: 'lot', rate: Math.round(val*0.2), total: Math.round(val*0.2) },
    { id: uid(), description: 'Installation labour', qty: Math.round(val*0.25/95), unit: 'hrs', rate: 95, total: Math.round(val*0.25/95)*95 },
    { id: uid(), description: 'Engineering & design', qty: Math.round(val*0.05/180), unit: 'hrs', rate: 180, total: Math.round(val*0.05/180)*180 },
    { id: uid(), description: 'Commissioning & testing', qty: Math.round(val*0.05/115), unit: 'hrs', rate: 115, total: Math.round(val*0.05/115)*115 },
  ],
  scaffold: (val) => [
    { id: uid(), description: 'Scaffold erect & dismantle', qty: 1, unit: 'lot', rate: Math.round(val*0.35), total: Math.round(val*0.35) },
    { id: uid(), description: 'Scaffold hire — weekly rate', qty: Math.round(val*0.4/1800), unit: 'wks', rate: 1800, total: Math.round(val*0.4/1800)*1800 },
    { id: uid(), description: 'Traffic management', qty: 1, unit: 'lot', rate: Math.round(val*0.1), total: Math.round(val*0.1) },
    { id: uid(), description: 'Site supervision', qty: Math.round(val*0.15/115), unit: 'hrs', rate: 115, total: Math.round(val*0.15/115)*115 },
  ],
  design: (val) => [
    { id: uid(), description: 'Fire engineer — design revision', qty: Math.round(val*0.4/220), unit: 'hrs', rate: 220, total: Math.round(val*0.4/220)*220 },
    { id: uid(), description: 'Hydraulic calculations & report', qty: Math.round(val*0.25/180), unit: 'hrs', rate: 180, total: Math.round(val*0.25/180)*180 },
    { id: uid(), description: 'Drawing revisions (3 sheets)', qty: 3, unit: 'ea', rate: Math.round(val*0.1/3), total: Math.round(val*0.1) },
    { id: uid(), description: 'Coordination & site verification', qty: Math.round(val*0.15/115), unit: 'hrs', rate: 115, total: Math.round(val*0.15/115)*115 },
    { id: uid(), description: 'Authority submission fee', qty: 1, unit: 'lot', rate: Math.round(val*0.1), total: Math.round(val*0.1) },
  ],
};

async function run() {
  const { data: signIn } = await supabase.auth.signInWithPassword({
    email: 'demo-gemfire@leveragedsystems.com.au',
    password: 'GemFireDemo2026!'
  });
  if (!signIn?.session) { console.error('Login failed'); process.exit(1); }
  console.log('✅ Signed in');

  // Get all variations without cost_items (or empty ones) that have a value > 0
  const { data: variations } = await supabase
    .from('variations')
    .select('id, title, estimated_value, cost_items, status')
    .gt('estimated_value', 50000); // > $500 AUD

  const toUpdate = variations.filter(v => !v.cost_items || v.cost_items.length === 0);
  console.log(`Found ${toUpdate.length} variations needing cost items`);

  const titleMap = {
    'scaffold': 'scaffold',
    'hydro': 'materials_heavy',
    'pump': 'labour_heavy',
    'design': 'design',
    'engineer': 'design',
    'hydraulic': 'design',
    'sprinkler': 'materials_heavy',
    'pipe': 'materials_heavy',
    'cylinder': 'materials_heavy',
    'suppression': 'materials_heavy',
    'deluge': 'materials_heavy',
    'valve': 'materials_heavy',
    'vessel': 'materials_heavy',
    'corrosion': 'labour_heavy',
    'confined': 'labour_heavy',
    'tunnel': 'materials_heavy',
    'ventilation': 'labour_heavy',
    'inspection': 'labour_heavy',
    'relocation': 'labour_heavy',
    'concrete': 'labour_heavy',
    'excavation': 'labour_heavy',
  };

  let updated = 0;
  for (const v of toUpdate) {
    const val = v.estimated_value; // in cents
    const valDollars = val / 100;
    
    // Pick cost set based on title keywords
    let costType = 'labour_heavy';
    const titleLower = v.title.toLowerCase();
    for (const [keyword, type] of Object.entries(titleMap)) {
      if (titleLower.includes(keyword)) { costType = type; break; }
    }
    
    const items = costSets[costType](valDollars);
    
    // Scale items so they sum to estimated_value
    const rawSum = items.reduce((s, i) => s + i.total, 0);
    if (rawSum > 0) {
      const scale = valDollars / rawSum;
      items.forEach(item => {
        item.rate = Math.round(item.rate * scale);
        item.total = Math.round(item.total * scale);
      });
      // Fix last item to ensure exact total
      const curSum = items.reduce((s, i) => s + i.total, 0);
      items[items.length-1].total += Math.round(valDollars - curSum);
    }

    const { error } = await supabase
      .from('variations')
      .update({ cost_items: items })
      .eq('id', v.id);
    
    if (error) {
      console.error(`❌ ${v.title}: ${error.message}`);
    } else {
      updated++;
      console.log(`✅ ${v.status.padEnd(10)} $${valDollars.toLocaleString()} — ${v.title.substring(0,55)}`);
    }
  }
  
  console.log(`\n✅ Done — updated ${updated}/${toUpdate.length} variations`);
}

run().catch(console.error);
