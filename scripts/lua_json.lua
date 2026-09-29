-- scripts/lua_json.lua
-- 极简 Lua → JSON 编码器（在 fengari 里跑，用于把 vars.lua 的表转成 JSON）
-- 只处理：nil/boolean/number/string/table（数组或纯字符串键的 map）
local json = {}

local function esc(s)
  s = s:gsub('\\', '\\\\')
  s = s:gsub('"', '\\"')
  s = s:gsub('\n', '\\n')
  s = s:gsub('\r', '\\r')
  s = s:gsub('\t', '\\t')
  return '"' .. s .. '"'
end

local function isArray(t)
  local n = 0
  for k, _ in pairs(t) do
    if type(k) ~= 'number' then return false end
    n = n + 1
  end
  return n == #t
end

function json.encode(v, indent, depth)
  depth = depth or 0
  local t = type(v)
  if v == nil then return 'null' end
  if t == 'boolean' then return tostring(v) end
  if t == 'number' then
    if v ~= v or v == math.huge or v == -math.huge then return 'null' end
    if math.type and math.type(v) == 'integer' then return string.format('%d', v) end
    return string.format('%.14g', v)
  end
  if t == 'string' then return esc(v) end
  if t ~= 'table' then return 'null' end

  local pad, pad2 = '', ''
  if indent then pad = string.rep(' ', (depth + 1) * indent); pad2 = string.rep(' ', depth * indent) end
  local sep = indent and (',\n' .. pad) or ','

  if isArray(v) and #v > 0 then
    local out = {}
    for i = 1, #v do out[#out + 1] = json.encode(v[i], indent, depth + 1) end
    if indent then return '[\n' .. pad .. table.concat(out, sep) .. '\n' .. pad2 .. ']' end
    return '[' .. table.concat(out, sep) .. ']'
  end

  local keys = {}
  for k, _ in pairs(v) do
    if type(k) == 'string' then keys[#keys + 1] = k end
  end
  table.sort(keys)
  local out = {}
  for _, k in ipairs(keys) do out[#out + 1] = esc(k) .. (indent and ': ' or ':') .. json.encode(v[k], indent, depth + 1) end
  if indent then return '{\n' .. pad .. table.concat(out, sep) .. '\n' .. pad2 .. '}' end
  return '{' .. table.concat(out, sep) .. '}'
end

return json
