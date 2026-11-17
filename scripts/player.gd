extends CharacterBody3D

## 玩家：悬浮水晶。WASD / 方向键移动，空格跳跃。

const SPEED := 7.5
const JUMP_VELOCITY := 6.2
const GRAVITY := 20.0
const SPAWN := Vector3(0.0, 0.76, 0.0)

var _model: Node3D


func _ready() -> void:
	var packed: PackedScene = load("res://assets/models/player_crystal.glb")
	if packed:
		_model = packed.instantiate()
		add_child(_model)
		_apply_material(_model, _make_crystal_material())


func _make_crystal_material() -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.30, 0.78, 1.0)
	mat.metallic = 0.10
	mat.roughness = 0.14
	mat.emission_enabled = true
	mat.emission = Color(0.20, 0.72, 1.0)
	mat.emission_energy_multiplier = 1.4
	return mat


func _apply_material(node: Node, mat: Material) -> void:
	if node is MeshInstance3D:
		node.material_override = mat
	for child in node.get_children():
		_apply_material(child, mat)


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= GRAVITY * delta

	if Input.is_key_pressed(KEY_SPACE) and is_on_floor():
		velocity.y = JUMP_VELOCITY

	var dir := Vector3.ZERO
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		dir.z -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		dir.z += 1.0
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		dir.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		dir.x += 1.0
	dir = dir.normalized()

	velocity.x = dir.x * SPEED
	velocity.z = dir.z * SPEED
	move_and_slide()

	# 掉出场地则回到出生点
	if global_position.y < -6.0:
		global_position = SPAWN
		velocity = Vector3.ZERO
