// Electrical strings (ADR-059: a module brings its own words). Same keys in every locale (tested).
export const MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en: {
    "module.electrical.name": "Electrical",
    "module.electrical.desc":
      "Outlets, switches and ceiling lights on the plan, the minimum number per room, and circuits with estimated loads.",
    "tool.outlet": "Outlet",
    "tool.outlet.tip": "Put a power outlet on a wall (the side you click is the side it faces)",
    "tool.switch": "Switch",
    "tool.switch.tip": "Put a light switch on a wall",
    "tool.light": "Light",
    "tool.light.tip": "Put a ceiling light point in a room",
    "hint.outlet": "Click on a wall, on the side of the room the outlet faces.",
    "hint.switch": "Click on a wall, on the side of the room the switch faces. Then pick its lights in the panel.",
    "hint.light": "Click inside a room where the ceiling light goes.",
    "cmd.add.outlet": "Add outlet",
    "cmd.add.switch": "Add switch",
    "cmd.add.light": "Add ceiling light",
    "cmd.editElectrical": "Change electrical item",
    "props.electrical": "Electrical",
    "elec.item.outlet": "Outlet",
    "elec.item.switch": "Switch",
    "elec.item.light": "Ceiling light",
    "elec.height.tip": "Height of the centre above the floor. Common: outlets 30 cm, switches 1.10 m.",
    "elec.purpose": "Used for",
    "elec.purpose.tip":
      "General outlets are for anything; a one-appliance outlet is for something like a shower or an air conditioner.",
    "elec.purpose.general": "General use",
    "elec.purpose.dedicated": "One appliance",
    "elec.turnsOn": "Turns on:",
    "elec.noLights": "No ceiling lights on this floor yet.",
    "elec.light.note": "Pick which switch turns it on in that switch's panel.",
    "elec.lightIn": "Light in {room}",
    "elec.lightN": "Light {n}",
    "elec.lights": "Ceiling lights: {n} (at least {min})",
    "elec.outlets.living": "General outlets: {n} (at least {min}: one per 5 m of the {perimeter} around the room)",
    "elec.outlets.kitchen": "General outlets: {n} (at least {min}: one per 3.5 m of the {perimeter} around the room)",
    "elec.outlets.bathroom": "General outlets: {n} (at least {min}, near the washbasin)",
    "elec.outlets.balcony": "General outlets: {n} (at least {min})",
    "elec.outlets.other": "General outlets: {n} (at least {min} for a room this size)",
    "elec.noType": "No room type set: the rule for other rooms is used. Set the room type above.",
    "elec.source": "Minimums of NBR 5410 for homes, from memory",
    "elec.height": "Height",
    "elec.unverified": "UNVERIFIED",
    "elec.circuits": "Circuit",
    "elec.circuit": "Circuit number",
    "elec.circuit.tip":
      "Which breaker on the panel feeds it (the number written on the panel). Choosing circuits is the electrician's job; Prumo only adds them up.",
    "elec.circuit.none": "— not given —",
    "elec.circuit.items":
      "On circuit {n}: {lights, plural, one {# light} other {# lights}}, {outlets, plural, one {# outlet} other {# outlets}}{dedicated, plural, =0 {} one {, # for one appliance} other {, # for one appliance each}}",
    "elec.circuit.load": "Estimated load: about {va} VA",
    "elec.circuit.unknown": "{count, plural, one {# item has} other {# items have}} no estimate yet (not in the total)",
    "elec.circuit.mixed":
      "Lights and outlets share this circuit. NBR 5410 asks for separate lighting and outlet circuits.",
    "elec.circuit.dedicatedShared":
      "A one-appliance outlet shares this circuit. NBR 5410 asks for a circuit of its own for appliances above 10 A.",
    "elec.circuit.unassigned":
      "{count, plural, one {# light or outlet} other {# lights and outlets}} in the project still {count, plural, one {has} other {have}} no circuit.",
    "elec.power": "Appliance power",
    "elec.power.tip": "The appliance's power from its label, in VA (or W). Leave empty if you don't know.",
    "elec.loads.source": "Loads: NBR 5410 rules for homes, from memory · rough sums, not a circuit design",
    "elec.loads.source.tip":
      "Lighting: 100 VA for the first 6 m² of a room, +60 VA per whole 4 m² more, shared by its light points. Outlets: 100 VA; kitchens, laundry areas and bathrooms 600 VA for the first 3 (2 if more than 6). An electrician sizes the real circuits.",
  },
  "pt-BR": {
    "module.electrical.name": "Elétrica",
    "module.electrical.desc":
      "Tomadas, interruptores e luzes de teto na planta, a quantidade mínima por cômodo e circuitos com cargas estimadas.",
    "tool.outlet": "Tomada",
    "tool.outlet.tip": "Colocar uma tomada na parede (o lado em que você clica é o lado para onde ela fica)",
    "tool.switch": "Interruptor",
    "tool.switch.tip": "Colocar um interruptor na parede",
    "tool.light": "Luz",
    "tool.light.tip": "Colocar um ponto de luz no teto de um cômodo",
    "hint.outlet": "Clique na parede, do lado do cômodo para onde a tomada fica.",
    "hint.switch":
      "Clique na parede, do lado do cômodo para onde o interruptor fica. Depois escolha as luzes no painel.",
    "hint.light": "Clique dentro do cômodo onde fica a luz do teto.",
    "cmd.add.outlet": "Adicionar tomada",
    "cmd.add.switch": "Adicionar interruptor",
    "cmd.add.light": "Adicionar ponto de luz",
    "cmd.editElectrical": "Alterar item elétrico",
    "props.electrical": "Elétrica",
    "elec.item.outlet": "Tomada",
    "elec.item.switch": "Interruptor",
    "elec.item.light": "Ponto de luz no teto",
    "elec.height.tip": "Altura do centro em relação ao piso. Comum: tomadas 30 cm, interruptores 1,10 m.",
    "elec.purpose": "Uso",
    "elec.purpose.tip":
      "Tomadas de uso geral servem para qualquer coisa; a de uso específico é para um aparelho, como chuveiro ou ar-condicionado.",
    "elec.purpose.general": "Uso geral (TUG)",
    "elec.purpose.dedicated": "Um aparelho (TUE)",
    "elec.turnsOn": "Acende:",
    "elec.noLights": "Ainda não há pontos de luz neste andar.",
    "elec.light.note": "Escolha qual interruptor acende esta luz no painel do interruptor.",
    "elec.lightIn": "Luz em {room}",
    "elec.lightN": "Luz {n}",
    "elec.lights": "Pontos de luz no teto: {n} (no mínimo {min})",
    "elec.outlets.living":
      "Tomadas de uso geral: {n} (no mínimo {min}: uma a cada 5 m dos {perimeter} em volta do cômodo)",
    "elec.outlets.kitchen":
      "Tomadas de uso geral: {n} (no mínimo {min}: uma a cada 3,5 m dos {perimeter} em volta do cômodo)",
    "elec.outlets.bathroom": "Tomadas de uso geral: {n} (no mínimo {min}, perto da pia)",
    "elec.outlets.balcony": "Tomadas de uso geral: {n} (no mínimo {min})",
    "elec.outlets.other": "Tomadas de uso geral: {n} (no mínimo {min} para um cômodo deste tamanho)",
    "elec.noType": "Cômodo sem tipo: vale a regra dos demais cômodos. Escolha o tipo acima.",
    "elec.source": "Mínimos da NBR 5410 para casas, de memória",
    "elec.height": "Altura",
    "elec.unverified": "NÃO VERIFICADO",
    "elec.circuits": "Circuito",
    "elec.circuit": "Número do circuito",
    "elec.circuit.tip":
      "Qual disjuntor do quadro alimenta este ponto (o número escrito no quadro). Escolher os circuitos é trabalho do eletricista; o Prumo só soma.",
    "elec.circuit.none": "— não definido —",
    "elec.circuit.items":
      "No circuito {n}: {lights, plural, one {# luz} other {# luzes}}, {outlets, plural, one {# tomada} other {# tomadas}}{dedicated, plural, =0 {} one {, # de uso específico} other {, # de uso específico}}",
    "elec.circuit.load": "Carga estimada: cerca de {va} VA",
    "elec.circuit.unknown":
      "{count, plural, one {# ponto ainda não tem} other {# pontos ainda não têm}} estimativa (fora do total)",
    "elec.circuit.mixed":
      "Luzes e tomadas no mesmo circuito. A NBR 5410 pede circuitos separados para iluminação e tomadas.",
    "elec.circuit.dedicatedShared":
      "Uma tomada de uso específico divide este circuito. A NBR 5410 pede um circuito só dela para aparelhos acima de 10 A.",
    "elec.circuit.unassigned":
      "{count, plural, one {# luz ou tomada} other {# luzes e tomadas}} do projeto ainda {count, plural, one {está} other {estão}} sem circuito.",
    "elec.power": "Potência do aparelho",
    "elec.power.tip": "A potência na etiqueta do aparelho, em VA (ou W). Deixe vazio se não souber.",
    "elec.loads.source":
      "Cargas: regras da NBR 5410 para casas, de memória · somas grosseiras, não é projeto de circuitos",
    "elec.loads.source.tip":
      "Iluminação: 100 VA para os primeiros 6 m² do cômodo, +60 VA a cada 4 m² inteiros a mais, divididos entre os pontos de luz. Tomadas: 100 VA; cozinhas, áreas de serviço e banheiros 600 VA para as 3 primeiras (2 se forem mais de 6). Um eletricista dimensiona os circuitos de verdade.",
  },
};
