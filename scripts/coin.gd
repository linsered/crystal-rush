extends Area3D

## 金币：自转 + 上下浮动。

var _t := 0.0
var _base_y := 0.0


func _ready() -> void:
	_base_y = position.y
	monitoring = true

	var packed: PackedScene = load("res://assets/models/coin.glb")
	if packed:
		var model: Node3D = packed.instantiate()
		add_child(model)
		_apply_material(model, _make_gold_material())


func _make_gold_material() -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.78, 0.22)
	mat.metallic = 0.35
	mat.roughness = 0.32
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.68, 0.12)
	mat.emission_energy_multiplier = 0.45
	return mat


func _apply_material(node: Node, mat: Material) -> void:
	if node is MeshInstance3D:
		node.material_override = mat
	for child in node.get_children():
		_apply_material(child, mat)


func _process(delta: float) -> void:
	_t += delta
	rotation.y = _t * 2.2
	position.y = _base_y + sin(_t * 2.5) * 0.12
