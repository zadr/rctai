#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/screenshot.sh [options] <input.park>

Required input:
  <input.park>                 Existing built/saved OpenRCT2 park file.

Output:
  -o, --output <output.png>    PNG path to write. Defaults to <input>.png.

OpenRCT2:
  --openrct2 <binary>          OpenRCT2 CLI binary or absolute path.
                               Defaults to $OPENRCT2_BIN, then "openrct2".

Viewport:
  --size <width>x<height>      Screenshot size in pixels. Use 0x0 for OpenRCT2 auto-size.
  --width <pixels>             Width in pixels. Default: 0.
  --height <pixels>            Height in pixels. Default: 0.
  --x <coord|c>                View center x coordinate, or c for map center. Default: c.
  --y <coord|c>                View center y coordinate, or c for map center. Default: c.
  --z <coord>                  Optional view center z coordinate.
  --zoom <0-3>                 OpenRCT2 zoom level. Default: 0.
  --rotation <0-3>             OpenRCT2 rotation. Default: 0.
  --saved-view                 Use the park's saved view instead of centering the map.
  --giant                      Use OpenRCT2 giant screenshot mode.

OpenRCT2 screenshot options:
  --weather <0-6>              0 default, 1 sunny, ..., 6 thunder.
  --no-peeps                   Hide guests.
  --no-sprites                 Hide all sprites.
  --clear-grass                Clear weeds.
  --mowed-grass                Mow grass.
  --water-plants               Water plants.
  --fix-vandalism              Fix vandalism.
  --remove-litter              Remove litter.
  --tidy-up-park               Clear grass, water plants, fix vandalism, and remove litter.
  --transparent                Transparent background.
  --draw-bounding-boxes        Draw bounding boxes.
  --draw-segment-heights       Draw segment heights.
  --openrct2-option <arg>      Append a raw OpenRCT2 screenshot option.

Examples:
  scripts/screenshot.sh build/rctai.park --output out/rctai.png
  scripts/screenshot.sh build/rctai.park --size 1600x1200 --zoom 1 --rotation 2
  scripts/screenshot.sh build/rctai.park --openrct2 /Applications/OpenRCT2.app/Contents/MacOS/openrct2

Install OpenRCT2 from https://openrct2.org/downloads and ensure the CLI binary is on PATH,
or pass the binary path with --openrct2. This wrapper runs OpenRCT2's headless screenshot
command:
  openrct2 screenshot <file> <output_image> <width> <height> [<x> <y> [<z>] <zoom> <rotation>]
  openrct2 screenshot <file> <output_image> giant <zoom> <rotation>
USAGE
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

need_value() {
  local flag=$1
  local count=$2
  if ((count < 2)); then
    die "$flag requires a value"
  fi
}

is_non_negative_integer() {
  [[ $1 =~ ^[0-9]+$ ]]
}

is_center_or_integer() {
  [[ $1 == "c" || $1 =~ ^[0-9]+$ ]]
}

lowercase() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

validate_non_negative_integer() {
  local name=$1
  local value=$2
  if ! is_non_negative_integer "$value"; then
    die "$name must be a non-negative integer, got '$value'"
  fi
}

validate_range() {
  local name=$1
  local value=$2
  local min=$3
  local max=$4

  validate_non_negative_integer "$name" "$value"
  if ((value < min || value > max)); then
    die "$name must be between $min and $max, got '$value'"
  fi
}

resolve_openrct2() {
  local candidate=$1

  if [[ $candidate == */* ]]; then
    if [[ ! -e $candidate ]]; then
      die "OpenRCT2 binary not found at '$candidate'. Install OpenRCT2 or pass --openrct2 with the correct binary path."
    fi
    if [[ ! -x $candidate ]]; then
      die "OpenRCT2 binary is not executable at '$candidate'. Check permissions or pass --openrct2 with an executable binary."
    fi
    printf '%s\n' "$candidate"
    return
  fi

  if command -v "$candidate" >/dev/null 2>&1; then
    command -v "$candidate"
    return
  fi

  die "OpenRCT2 binary '$candidate' was not found on PATH. Install OpenRCT2 from https://openrct2.org/downloads, set OPENRCT2_BIN, or pass --openrct2 /path/to/openrct2."
}

openrct2_bin=${OPENRCT2_BIN:-openrct2}
output_path=
width=0
height=0
view_x=c
view_y=c
view_z=
zoom=0
rotation=0
saved_view=false
giant=false
positionals=()
screenshot_options=()

while (($# > 0)); do
  case $1 in
    -h|--help)
      usage
      exit 0
      ;;
    --openrct2)
      need_value "$1" "$#"
      openrct2_bin=$2
      shift 2
      ;;
    --openrct2=*)
      openrct2_bin=${1#*=}
      shift
      ;;
    -o|--output)
      need_value "$1" "$#"
      output_path=$2
      shift 2
      ;;
    --output=*)
      output_path=${1#*=}
      shift
      ;;
    --size)
      need_value "$1" "$#"
      if [[ ! $2 =~ ^([0-9]+)[xX]([0-9]+)$ ]]; then
        die "--size must be WIDTHxHEIGHT, got '$2'"
      fi
      width=${BASH_REMATCH[1]}
      height=${BASH_REMATCH[2]}
      shift 2
      ;;
    --size=*)
      size_value=${1#*=}
      if [[ ! $size_value =~ ^([0-9]+)[xX]([0-9]+)$ ]]; then
        die "--size must be WIDTHxHEIGHT, got '$size_value'"
      fi
      width=${BASH_REMATCH[1]}
      height=${BASH_REMATCH[2]}
      shift
      ;;
    --width)
      need_value "$1" "$#"
      width=$2
      shift 2
      ;;
    --width=*)
      width=${1#*=}
      shift
      ;;
    --height)
      need_value "$1" "$#"
      height=$2
      shift 2
      ;;
    --height=*)
      height=${1#*=}
      shift
      ;;
    --x)
      need_value "$1" "$#"
      view_x=$2
      shift 2
      ;;
    --x=*)
      view_x=${1#*=}
      shift
      ;;
    --y)
      need_value "$1" "$#"
      view_y=$2
      shift 2
      ;;
    --y=*)
      view_y=${1#*=}
      shift
      ;;
    --z)
      need_value "$1" "$#"
      view_z=$2
      shift 2
      ;;
    --z=*)
      view_z=${1#*=}
      shift
      ;;
    --zoom)
      need_value "$1" "$#"
      zoom=$2
      shift 2
      ;;
    --zoom=*)
      zoom=${1#*=}
      shift
      ;;
    --rotation)
      need_value "$1" "$#"
      rotation=$2
      shift 2
      ;;
    --rotation=*)
      rotation=${1#*=}
      shift
      ;;
    --saved-view)
      saved_view=true
      shift
      ;;
    --giant)
      giant=true
      shift
      ;;
    --weather)
      need_value "$1" "$#"
      screenshot_options+=("$1" "$2")
      shift 2
      ;;
    --weather=*)
      screenshot_options+=("--weather" "${1#*=}")
      shift
      ;;
    --no-peeps|--no-sprites|--clear-grass|--mowed-grass|--water-plants|--fix-vandalism|--remove-litter|--tidy-up-park|--transparent|--draw-bounding-boxes|--draw-segment-heights)
      screenshot_options+=("$1")
      shift
      ;;
    --openrct2-option)
      need_value "$1" "$#"
      screenshot_options+=("$2")
      shift 2
      ;;
    --)
      shift
      while (($# > 0)); do
        positionals+=("$1")
        shift
      done
      ;;
    -*)
      die "unknown option '$1'. Run scripts/screenshot.sh --help for usage."
      ;;
    *)
      positionals+=("$1")
      shift
      ;;
  esac
done

if ((${#positionals[@]} != 1)); then
  die "expected exactly one input .park file"
fi

input_path=${positionals[0]}
if [[ -z $input_path ]]; then
  die "input path must not be empty"
fi

input_lower=$(lowercase "$input_path")
if [[ $input_lower != *.park ]]; then
  die "input must be a .park file, got '$input_path'"
fi
if [[ ! -f $input_path ]]; then
  die "input park does not exist: '$input_path'"
fi

if [[ -z $output_path ]]; then
  output_path=${input_path%.*}.png
fi
if [[ -z $output_path ]]; then
  die "output path must not be empty"
fi

output_lower=$(lowercase "$output_path")
if [[ $output_lower != *.png ]]; then
  die "output must be a .png file, got '$output_path'"
fi
if [[ $output_path == "$input_path" ]]; then
  die "output path must be different from input path"
fi

output_dir=$(dirname "$output_path")
if [[ ! -d $output_dir ]]; then
  die "output directory does not exist: '$output_dir'"
fi
if [[ -e $output_path && ! -w $output_path ]]; then
  die "output file is not writable: '$output_path'"
fi
if [[ ! -e $output_path && ! -w $output_dir ]]; then
  die "output directory is not writable: '$output_dir'"
fi

validate_non_negative_integer "--width" "$width"
validate_non_negative_integer "--height" "$height"
validate_range "--zoom" "$zoom" 0 3
validate_range "--rotation" "$rotation" 0 3

if ! is_center_or_integer "$view_x"; then
  die "--x must be a non-negative integer or c, got '$view_x'"
fi
if ! is_center_or_integer "$view_y"; then
  die "--y must be a non-negative integer or c, got '$view_y'"
fi
if [[ -n $view_z ]]; then
  validate_non_negative_integer "--z" "$view_z"
fi

for ((i = 0; i < ${#screenshot_options[@]}; i++)); do
  if [[ ${screenshot_options[$i]} == "--weather" ]]; then
    if ((i + 1 >= ${#screenshot_options[@]})); then
      die "--weather requires a value"
    fi
    validate_range "--weather" "${screenshot_options[$((i + 1))]}" 0 6
  fi
done

if [[ $giant == true && $saved_view == true ]]; then
  die "--giant cannot be combined with --saved-view"
fi
if [[ $giant == true ]]; then
  if [[ $width != 0 || $height != 0 || $view_x != "c" || $view_y != "c" || -n $view_z ]]; then
    die "--giant cannot be combined with --size, --width, --height, --x, --y, or --z"
  fi
fi
if [[ $saved_view == true && ( -n $view_z || $view_x != "c" || $view_y != "c" ) ]]; then
  die "--saved-view cannot be combined with --x, --y, or --z"
fi

resolved_openrct2=$(resolve_openrct2 "$openrct2_bin")

cmd=("$resolved_openrct2" screenshot "$input_path" "$output_path")
if [[ $giant == true ]]; then
  cmd+=("giant" "$zoom" "$rotation")
else
  cmd+=("$width" "$height")
  if [[ $saved_view == false ]]; then
    cmd+=("$view_x" "$view_y")
    if [[ -n $view_z ]]; then
      cmd+=("$view_z")
    fi
    cmd+=("$zoom" "$rotation")
  fi
fi
if ((${#screenshot_options[@]} > 0)); then
  cmd+=("${screenshot_options[@]}")
fi

printf 'Running:'
printf ' %q' "${cmd[@]}"
printf '\n'
"${cmd[@]}"

if [[ ! -s $output_path ]]; then
  die "OpenRCT2 completed but did not create a non-empty PNG at '$output_path'"
fi

printf 'Wrote screenshot: %s\n' "$output_path"
