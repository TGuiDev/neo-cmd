-- Neo CMD: avisa o terminal a pasta atual a cada prompt (OSC 9;9).
-- Prompts personalizados do Clink (oh-my-posh, clink-flex-prompt, Starship...)
-- substituem o PROMPT do cmd; este evento roda antes de cada prompt, com qualquer tema.
if os.getenv("NEO_CMD") and clink and clink.onbeginedit then
  clink.onbeginedit(function()
    io.write("\027]9;9;" .. os.getcwd() .. "\027\\")
    io.flush()
  end)
end
