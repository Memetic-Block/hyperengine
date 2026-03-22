local hyperstache = require('hyperstache')

local admin = {}

local _path = 'admin'

function admin.render()
  local html = hyperstache.renderTemplate(
    'admin/index.html',
    { ao_env = require('json').encode(ao.env) }
  )
  hyperstache_admin = html
  return html
end

function admin.publish()
  if not hyperstache_admin then
    admin.render()
  end
  hyperstache.publish({ [_path] = hyperstache_admin })
end

admin.render()
hyperstache.patch({ [_path] = hyperstache_admin })

return admin
