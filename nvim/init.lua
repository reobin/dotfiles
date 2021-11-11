require("config.plugins")

-- #general --

local home = os.getenv("HOME")
local vimp = require("vimp")

-- tabs
vim.o.autoindent = true -- Copy indent from current line
vim.o.tabstop = 2 -- Number of spaces that a <Tab> counts for
vim.o.shiftwidth = vim.o.tabstop -- The amount of indent added
vim.o.expandtab = true -- Insert spaces with the <Tab> key

vim.o.relativenumber = true -- Use relative number on gutter
vim.o.hidden = true -- Do not unload buffers when switching
vim.o.signcolumn = "yes" -- Always show sign column
vim.o.termguicolors = true -- use GUI colors

-- menuone: show menu even if only one item is present
-- noselect: do not automatically select an item in the menu
vim.o.completeopt = "menuone,noselect"

-- map leader: <Space>
vim.g.mapleader = " "

-- J = keep the cursor in place while joining lines
vimp.nnoremap("J", "mzJ`z")

-- leader + r = reload vimrc
vimp.nnoremap(
  "<leader>r",
  function()
    -- remove all previously added vimpeccable maps
    vimp.unmap_all()

    -- make sure all open buffers are saved
    vim.cmd("silent wa")

    for packagename in pairs(package.loaded) do
      if packagename:match("^config%..*") then
        print("reloading", packagename)
        package.loaded[packagename] = nil
      end
    end

    -- execute our vimrc lua file again to add back our maps
    dofile(vim.fn.stdpath("config") .. "/init.lua")

    print("init.lua reloaded")
  end
)

-- leader + l = open last buffer
vimp.nnoremap("<leader>l", "<C-^>")

-- leader + c = copy to clipboard
vimp.xnoremap("<leader>c", '"*y')

-- leader + / = remove search highlight
vimp.nnoremap("<leader>/", ":noh<cr>")

-- #lualine --

local lualine = require("lualine")
lualine.setup(
  {
    options = {
      theme = "github",
      component_separators = "|",
      section_separators = ""
    },
    sections = {
      lualine_a = {{"mode"}},
      lualine_b = {{"filename", path = 1}, "branch"},
      lualine_c = {
        {
          "diff",
          symbols = {added = " ", modified = "⦿ ", removed = " "},
          diff_color = {
            added = {fg = "green"},
            modified = {fg = "orange"},
            removed = {fg = "darkred"}
          }
        }
      },
      lualine_x = {},
      lualine_y = {"filetype", "progress"},
      lualine_z = {
        {"location"}
      }
    },
    inactive_sections = {
      lualine_a = {"filename"},
      lualine_b = {},
      lualine_c = {},
      lualine_x = {},
      lualine_y = {},
      lualine_z = {"location"}
    },
    tabline = {},
    extensions = {}
  }
)

-- #telescope --

vimp.nnoremap("<leader>p", ":Telescope find_files<cr>")
vimp.nnoremap("<leader>s", ":Telescope live_grep<cr>")
vimp.nnoremap("<leader>B", ":Telescope live_grep<cr>")

local actions = require("telescope.actions")
local telescope = require("telescope")

telescope.setup {
  defaults = {
    mappings = {
      i = {["<ESC>"] = actions.close}
    }
  }
}

vimp.nnoremap("<leader><leader>r", ":Telescope lsp_references<cr>")
vimp.nnoremap("<leader><leader>d", ":Telescope lsp_definitions<cr>")

-- #treesitter --

treesitter_languages = {
  "go",
  "javascript",
  "lua",
  "tsx",
  "typescript"
}

polyglot_languages = {
  "elixir"
}

local treesitter = require("nvim-treesitter.configs")

treesitter.setup {
  ensure_installed = treesitter_languages,
  highlight = {
    enable = true,
    disable = polyglot_languages
  }
}

vim.g.polyglot_disabled = treesitter_languages

-- #lsp --

vimp.nnoremap("<leader><leader>h", ":lua vim.lsp.buf.hover()<cr>")
vimp.nnoremap("<leader><leader>e", ":lua vim.lsp.diagnostic.show_line_diagnostics()<cr>")

local lsp = require("lspconfig")

lsp.tsserver.setup {}
lsp.gopls.setup {}

-- #nvim ---cmp

local cmp = require("cmp")

cmp.setup {
  snippet = {
    expand = function(args)
      require "luasnip".lsp_expand(args.body)
    end
  },
  sources = {
    {name = "nvim_lsp"},
    {name = "luasnip"},
    {name = "buffer"}
  },
  mapping = {
    ["<cr>"] = cmp.mapping.confirm({select = true})
  }
}

-- #formatter --.nvim

local formatter = require("formatter")

local prettier = function()
  return {
    exe = "prettier",
    args = {"--stdin-filepath", vim.api.nvim_buf_get_name(0)},
    stdin = true
  }
end

formatter.setup {
  filetype = {
    html = {prettier},
    javascript = {prettier},
    javascriptreact = {prettier},
    json = {prettier},
    markdown = {prettier},
    scss = {prettier},
    typescript = {prettier},
    typescriptreact = {prettier},
    elixir = {
      function()
        return {
          exe = "mix format",
          args = {"-"},
          stdin = true
        }
      end
    },
    go = {
      function()
        return {
          exe = "gofmt",
          args = {vim.api.nvim_buf_get_name(0)},
          stdin = true
        }
      end
    },
    lua = {
      function()
        return {
          exe = "luafmt",
          args = {"--indent-count", 2, "--stdin"},
          stdin = true
        }
      end
    }
  }
}

vimp.nnoremap("<leader>f", ":FormatWrite<cr>")

-- #git-fugitive --

vimp.nnoremap("<leader>gg", ":G<cr>")

-- #nvim-tree --

vimp.nnoremap(
  "<leader>ee",
  function()
    local filepath = vim.fn.expand("%")
    if filepath == "" or filepath == "NvimTree" then
      vim.cmd(":NvimTreeFindFileToggle")
    else
      vim.cmd(":NvimTreeFindFile")
    end
  end
)

-- #gitsigns --

vimp.nnoremap("<leader>gb", ":Gitsigns blame_line<cr>")

-- #harpoon --

vimp.nnoremap("<leader>a", ":lua require('harpoon.mark').add_file()<cr>")
vimp.nnoremap("<leader>b", ":lua require('harpoon.ui').toggle_quick_menu()<cr>")
vimp.nnoremap("<leader>1", ":lua require('harpoon.ui').nav_file(1)<cr>")
vimp.nnoremap("<leader>2", ":lua require('harpoon.ui').nav_file(2)<cr>")
vimp.nnoremap("<leader>3", ":lua require('harpoon.ui').nav_file(3)<cr>")
vimp.nnoremap("<leader>4", ":lua require('harpoon.ui').nav_file(4)<cr>")

-- #hop --

require "hop".setup()

vimp.nnoremap("<leader>j", ":HopWord<cr>")
vimp.nnoremap("<leader>J", ":HopLine<cr>")

-- #vimwiki --

vim.g.vimwiki_list = {
  {
    path = "~/dev/notes",
    path_html = "~/dev/notes/html",
    syntax = "markdown",
    ext = ".md"
  }
}

vim.g.glow_border = "rounded"

vimp.nnoremap("<leader>wp", ":Glow<cr>")
