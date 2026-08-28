from pathlib import Path

path = Path('app/src/app/room/[code]/page.tsx')
text = path.read_text(encoding='utf-8')

old = '''  async function resetRoomData(rid: string) {
    await supabase.from("scores").delete().eq("room_id", rid);
    await supabase.from("answers").delete().eq("room_id", rid);
    await supabase.from("rounds").delete().eq("room_id", rid);

    await supabase
      .from("rooms")
      .update({ status: "lobby", letter: null })
      .eq("id", rid);
'''

new = '''  async function resetRoomData(rid: string) {
    await Promise.all([
      supabase.from("scores").delete().eq("room_id", rid),
      supabase.from("answers").delete().eq("room_id", rid),
      supabase.from("rounds").delete().eq("room_id", rid),
      supabase
        .from("rooms")
        .update({ status: "lobby", letter: null })
        .eq("id", rid),
    ]);
'''

count = text.count(old)
if count != 1:
    raise SystemExit(f'Expected exactly 1 resetRoomData block, got {count}')

path.write_text(text.replace(old, new, 1), encoding='utf-8')
