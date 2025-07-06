<template>
  <v-dialog v-model="show" absolute :disabled="disabled">
    <template v-slot:activator="{ on }">
      <v-btn v-on="on" plain :disabled="disabled">
        <v-icon v-if="icon">{{ icon }}</v-icon> {{ label }}
      </v-btn>
    </template>
    <v-card>
      <v-card-title>
        <div class="text-h5 d-flex" style="width: 100%">
            <slot name="title"></slot>
            <v-spacer></v-spacer>
            <slot name="toolbar-extra"></slot>
        </div>
      </v-card-title>
      <v-card-text>
        <slot name="text"></slot>
      </v-card-text>
      <v-card-actions>
        <v-btn color="primary" text @click.native="close">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'ModalDialog',
  props: {
    value: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    icon: {
      type: String,
      default: ''
    },
    label: {
      type: String,
      default: ''
    },
  },
  computed: {
    show: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    }
  },
  methods: {
    close() {
      this.show = false;
    }
  }
};
</script>
