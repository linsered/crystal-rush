extends Node3D

## Crystal Rush —— 测试用小游戏
## 目标：60 秒内收集场上全部 8 枚金币。WASD/方向键移动，空格跳跃，R 重开。

const TOTAL_TIME := 60.0
const COIN_COUNT := 8
const GRASS_TEX := "res://assets/textures/ground_grass.png"
const STONE_TEX := "res://assets/textures/stone_brick.png"

var score := 0
var time_left := TOTAL_TIME
var playing := true

var player: CharacterBody3D
var camera: Camera3D
var hud_score: Label
var hud_time: Label
var hud_result: Label
var coin_root: Node3D


func _ready() -> void:
	_build_light()
	_build_arena()
	_build_player()
	_build_coins()
	_build_camera()
	_build_hud()


func _process(delta: float) -> void:
	if not playing:
		if Input.is_key_pressed(KEY_R):
			get_tree().reload_current_scene()
		return

	time_left = max(0.0, time_left - delta)
	_update_hud()

	if time_left <= 0.0:
		_game_over(false)

	if camera and player:
		var want := player.global_position + Vector3(0.0, 8.5, 9.5)
		camera.global_position = camera.global_position.lerp(want, clampf(6.0 * delta, 0.0, 1.0))
		camera.look_at(player.global_position + Vector3.UP * 0.6, Vector3.UP)

	if Input.is_key_pressed(KEY_R):
		get_tree().reload_current_scene()


func _make_material(tex_path: String, uv_scale: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	var tex := load(tex_path)
	if tex is Texture2D:
		mat.albedo_texture = tex
		mat.uv1_scale = Vector3(uv_scale, uv_scale, 1.0)
		mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	mat.roughness = 0.85
	return mat


func _build_light() -> void:
	var light := DirectionalLight3D.new()
	light.name = "SunLight"
	light.rotation_degrees = Vector3(-52.0, -38.0, 0.0)
	light.light_energy = 1.15
	light.shadow_enabled = true
	add_child(light)

	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.47, 0.67, 0.90)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.66, 0.75, 0.88)
	env.ambient_light_energy = 1.0
	we.environment = env
	add_child(we)


func _build_arena() -> void:
	var ground := MeshInstance3D.new()
	ground.name = "Ground"
	var pm := PlaneMesh.new()
	pm.size = Vector2(26.0, 26.0)
	ground.mesh = pm
	ground.material_override = _make_material(GRASS_TEX, 13.0)
	add_child(ground)

	var ground_body := StaticBody3D.new()
	ground_body.name = "GroundBody"
	var gcs := CollisionShape3D.new()
	var gbox := BoxShape3D.new()
	gbox.size = Vector3(26.0, 0.4, 26.0)
	gcs.shape = gbox
	gcs.position = Vector3(0.0, -0.2, 0.0)
	ground_body.add_child(gcs)
	add_child(ground_body)

	var pillars := [
		Vector3(4.0, 1.25, 3.0),
		Vector3(-5.0, 1.25, -4.0),
		Vector3(6.5, 1.25, -6.0),
		Vector3(-6.5, 1.25, 5.0)
	]
	for i in pillars.size():
		_build_pillar(pillars[i], 18.0 * float(i))


func _build_pillar(pos: Vector3, yaw: float) -> void:
	var size := Vector3(1.4, 2.5, 1.4)

	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = _make_material(STONE_TEX, 1.0)
	mi.position = pos
	mi.rotation_degrees = Vector3(0.0, yaw, 0.0)
	add_child(mi)

	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	body.position = pos
	body.rotation_degrees = Vector3(0.0, yaw, 0.0)
	add_child(body)


func _build_player() -> void:
	player = CharacterBody3D.new()
	player.name = "Player"
	player.set_script(load("res://scripts/player.gd"))

	var cs := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = 0.5
	cyl.height = 1.4
	cs.shape = cyl
	player.add_child(cs)

	player.position = Vector3(0.0, 0.76, 0.0)
	add_child(player)


func _build_coins() -> void:
	coin_root = Node3D.new()
	coin_root.name = "Coins"
	add_child(coin_root)

	var spots := [
		Vector3(3.0, 0.9, -2.0),
		Vector3(-3.0, 0.9, 4.0),
		Vector3(7.0, 0.9, 6.0),
		Vector3(-7.0, 0.9, -6.0),
		Vector3(0.0, 0.9, 8.5),
		Vector3(8.5, 0.9, -8.0),
		Vector3(-8.5, 0.9, 7.5),
		Vector3(2.0, 0.9, -7.5)
	]

	for spot in spots:
		var coin := Area3D.new()
		coin.name = "Coin"
		coin.set_script(load("res://scripts/coin.gd"))
		coin.set_meta("base_y", spot.y)

		var cs := CollisionShape3D.new()
		var sphere := SphereShape3D.new()
		sphere.radius = 0.8
		cs.shape = sphere
		coin.add_child(cs)

		coin.position = spot
		coin.body_entered.connect(_on_coin_body_entered.bind(coin))
		coin_root.add_child(coin)


func _on_coin_body_entered(body: Node3D, coin: Node3D) -> void:
	if not playing or body != player:
		return
	if not is_instance_valid(coin):
		return

	score += 1
	coin.queue_free()
	_update_hud()

	if score >= COIN_COUNT:
		_game_over(true)


func _build_camera() -> void:
	camera = Camera3D.new()
	camera.name = "FollowCamera"
	camera.fov = 58.0
	camera.position = Vector3(0.0, 8.5, 9.5)
	add_child(camera)
	camera.look_at(Vector3(0.0, 0.6, 0.0), Vector3.UP)


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	layer.name = "HUD"
	add_child(layer)

	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(root)

	hud_score = _make_label("COINS 0 / %d" % COIN_COUNT, 32, Color(1.0, 0.93, 0.6))
	hud_score.position = Vector2(26.0, 20.0)
	root.add_child(hud_score)

	hud_time = _make_label("TIME %d" % int(TOTAL_TIME), 32, Color(0.85, 0.95, 1.0))
	hud_time.position = Vector2(26.0, 62.0)
	root.add_child(hud_time)

	hud_result = _make_label("", 58, Color(1.0, 1.0, 1.0))
	hud_result.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud_result.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud_result.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	root.add_child(hud_result)


func _make_label(text: String, size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_shadow_color", Color(0.0, 0.0, 0.0, 0.75))
	label.add_theme_constant_override("shadow_offset_x", 2)
	label.add_theme_constant_override("shadow_offset_y", 3)
	return label


func _update_hud() -> void:
	if hud_score:
		hud_score.text = "COINS %d / %d" % [score, COIN_COUNT]
	if hud_time:
		hud_time.text = "TIME %d" % int(ceil(time_left))


func _game_over(won: bool) -> void:
	if not playing:
		return
	playing = false

	if player:
		player.set_physics_process(false)

	if hud_result:
		hud_result.text = "ALL COINS COLLECTED!" if won else "TIME UP!"
		hud_result.add_theme_color_override(
			"font_color", Color(0.6, 1.0, 0.7) if won else Color(1.0, 0.65, 0.55)
		)

	if hud_time:
		hud_time.text = "PRESS R TO RESTART"
