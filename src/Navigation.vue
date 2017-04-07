<template>
    <nav class="navbar navbar-default navbar-fixed-top">
		<div class="container">
			<div class="navbar-header">
				<button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false"
					aria-controls="navbar">
                    <span class="sr-only">Toggle navigation</span>
                    <span class="icon-bar"></span>
                    <span class="icon-bar"></span>
                    <span class="icon-bar"></span>
                </button>
				<a class="navbar-brand" href="#">
                	<object type="image/svg+xml" data="marv1.svg" aria-hidden="true">
						<img src="marv1.png" />
					</object>
					<span>MMseqs</span>
				</a>
			</div>
			<div id="navbar" class="collapse navbar-collapse">
				<ul class="nav navbar-nav">
					<router-link to="/" tag="li" exact><a>Home</a></router-link>
				</ul>
			</div>
		</div>
	</nav>
</template>