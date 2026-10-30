<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { LogIn } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { loginOpen, openLogin, refreshSignIn } from "@/state";

// The axis_auth cookie appears while the login is still redirecting, so the first
// check can still land on the login page. Keep checking while waiting: the cookie
// read is local, axis.com is only asked once the cookie exists.
let poll: ReturnType<typeof setInterval> | undefined;
onMounted(() => { poll = setInterval(refreshSignIn, 3000); });
onBeforeUnmount(() => clearInterval(poll));
</script>

<template>
  <Empty class="min-h-[calc(100vh-120px)]">
    <EmptyHeader class="max-w-md">
      <!-- Lock on soft rings: theme colours only, so it follows light/dark. -->
      <svg viewBox="0 0 240 190" class="mb-4 h-44 w-auto" aria-hidden="true">
        <circle cx="120" cy="95" r="84" class="fill-primary/10" />
        <circle cx="120" cy="95" r="66" fill="none" stroke-dasharray="4 7" stroke-width="1.5" class="stroke-primary/40" />
        <circle cx="40" cy="44" r="3" class="fill-primary/40" />
        <circle cx="206" cy="58" r="2.5" class="fill-primary/30" />
        <circle cx="198" cy="150" r="3.5" class="fill-primary/25" />
        <circle cx="34" cy="132" r="2" class="fill-primary/35" />

        <circle cx="120" cy="95" r="44" class="fill-primary" />
        <path d="M106 92 v-11 a14 14 0 0 1 28 0 v11" fill="none" stroke-width="5" stroke-linecap="round" class="stroke-primary-foreground" />
        <rect x="99" y="90" width="42" height="30" rx="7" class="fill-primary-foreground" />
        <circle cx="120" cy="102" r="4.2" class="fill-primary" />
        <path d="M120 104 v7" stroke-width="3.5" stroke-linecap="round" class="stroke-primary" />
      </svg>
      <EmptyTitle class="text-xl">Sign in to My Axis first</EmptyTitle>
      <EmptyDescription>
        Firmware downloads need your axis.com account. Sign in in the window that opens;
        it closes by itself and this page continues.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <div v-if="loginOpen" class="flex flex-col items-center gap-3">
        <span class="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Waiting for the sign-in…</span>
        <Button variant="outline" @click="openLogin">Show sign-in window</Button>
      </div>
      <Button v-else @click="openLogin"><LogIn /> Sign in to My Axis</Button>
    </EmptyContent>
  </Empty>
</template>
